import {
  Ok,
  Err,
  type Result,
  DomainErrors,
  type DomainError,
  createDosage,
  createTimeOfDay,
  createDosageScheme,
  createVisualProfile,
  createStockInfo,
  createTreatment,
  createDoseSlot,
  calculateScheduledDoseTimes,
  type TreatmentRepository,
  type MedicationCatalogRepository,
  type TimeOfDay,
  type Dose,
  type Treatment,
} from '../../domain';
import type { UseCase } from '../core/use-case';
import type { Clock } from '../ports/clock.port';
import type { IdGenerator } from '../ports/id-generator.port';
import type { NotificationScheduler } from '../ports/notification-scheduler.port';
import type { RegisterTreatmentInput, RegisterTreatmentOutput } from '../dto/register-treatment.dto';

const DEFAULT_SCHEDULING_HORIZON_DAYS = 30;

/**
 * CU-01 "Registrar Tratamiento y Configurar Perfil Visual del Medicamento".
 *
 * Orquestación:
 *  1. Resuelve el medicamento contra el catálogo (pasos 2-5 del CU).
 *  2. Construye y valida cada Value Object del agregado (pasos 6-8) usando
 *     las factories de dominio — cualquier invariante violada corta acá,
 *     antes de generar ids o abrir transacción.
 *  3. Persiste `Treatment` + slots iniciales de `Dose` atómicamente.
 *  4. Programa alarmas del OS (ACT-03) best-effort, FUERA de la transacción:
 *     una falla de notificación no debe revertir el alta del tratamiento.
 */
export class RegisterTreatmentUseCase
  implements UseCase<RegisterTreatmentInput, RegisterTreatmentOutput>
{
  constructor(
    private readonly medicationCatalogRepository: MedicationCatalogRepository,
    private readonly treatmentRepository: TreatmentRepository,
    private readonly notificationScheduler: NotificationScheduler,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(
    input: RegisterTreatmentInput,
  ): Promise<Result<RegisterTreatmentOutput, DomainError>> {
    // --- 1. Resolución del medicamento (CU-01 pasos 2-5) ---
    const medicationResult = await this.medicationCatalogRepository.findById(input.medicationId);
    if (!medicationResult.ok) return medicationResult;
    const medication = medicationResult.value;
    if (!medication) return Err(DomainErrors.medicationNotFound(input.medicationId));

    // --- 2. Construcción y validación de Value Objects (CU-01 pasos 6-8) ---
    const visualProfileResult = createVisualProfile(input.visualProfile);
    if (!visualProfileResult.ok) return visualProfileResult;

    const timesOfDayResult = this.buildTimesOfDay(input.dosageScheme.timesOfDay);
    if (!timesOfDayResult.ok) return timesOfDayResult;

    const dosagePerTakeResult = createDosage(
      input.dosageScheme.dosagePerTake.amount,
      input.dosageScheme.dosagePerTake.unit,
    );
    if (!dosagePerTakeResult.ok) return dosagePerTakeResult;

    const dosageSchemeResult = createDosageScheme({
      frequency: input.dosageScheme.frequency,
      timesOfDay: timesOfDayResult.value,
      dosagePerTake: dosagePerTakeResult.value,
      startDate: input.dosageScheme.startDate,
      endDate: input.dosageScheme.endDate,
      intervalDays: input.dosageScheme.intervalDays,
      weekdays: input.dosageScheme.weekdays,
    });
    if (!dosageSchemeResult.ok) return dosageSchemeResult;

    const stockResult = createStockInfo(input.initialStock);
    if (!stockResult.ok) return stockResult;

    // --- 3. Construcción del agregado raíz ---
    const now = this.clock.now();
    const treatmentResult = createTreatment({
      id: this.idGenerator.generate(),
      patientId: input.patientId,
      caregiverId: input.caregiverId,
      medication,
      visualProfile: visualProfileResult.value,
      dosageScheme: dosageSchemeResult.value,
      stock: stockResult.value,
      now,
    });
    if (!treatmentResult.ok) return treatmentResult;
    const treatment = treatmentResult.value;

    // --- 4. Materialización de slots iniciales (postcondición: "slots creados") ---
    const horizonDays = input.schedulingHorizonDays ?? DEFAULT_SCHEDULING_HORIZON_DAYS;
    const horizonEnd = new Date(now);
    horizonEnd.setDate(horizonEnd.getDate() + horizonDays);

    const scheduledTimes = calculateScheduledDoseTimes(
      treatment.dosageScheme,
      now,
      horizonEnd,
    );

    const dosesResult = this.buildDoseSlots(treatment.id, scheduledTimes);
    if (!dosesResult.ok) return dosesResult;

    // --- 5. Persistencia atómica: tratamiento + slots, todo o nada ---
    const persistResult = await this.treatmentRepository.createWithInitialDoses(
      treatment,
      dosesResult.value,
    );
    if (!persistResult.ok) return persistResult;

    // --- 6. Las alarmas NO se programan acá ---
    // El alta es una pantalla del Cuidador, y las alarmas de notifee son
    // locales al teléfono que las programa: programarlas acá le hacía sonar
    // al Cuidador las pastillas de otra persona, y dejaba al Adulto Mayor
    // sin ninguna. Ahora las arma `SyncDoseAlarmsUseCase` al abrir el
    // pastillero, en el teléfono que tiene que sonar.
    //
    // `notificationWarnings` queda vacío a propósito: el contrato del DTO no
    // cambia, pero desde acá ya no hay alarma que pueda fallar.
    return Ok({
      treatment: persistResult.value.treatment,
      generatedDoses: persistResult.value.generatedDoses,
      notificationWarnings: [],
    });
  }

  private buildTimesOfDay(
    raw: readonly { hour: number; minute: number }[],
  ): Result<readonly TimeOfDay[], DomainError> {
    const built: TimeOfDay[] = [];
    for (const t of raw) {
      const result = createTimeOfDay(t.hour, t.minute);
      if (!result.ok) return result;
      built.push(result.value);
    }
    return Ok(built);
  }

  private buildDoseSlots(
    treatmentId: string,
    scheduledTimes: readonly Date[],
  ): Result<readonly Dose[], DomainError> {
    const doses: Dose[] = [];
    for (const scheduledAt of scheduledTimes) {
      const result = createDoseSlot({
        id: this.idGenerator.generate(),
        treatmentId,
        scheduledAt,
      });
      if (!result.ok) return result;
      doses.push(result.value);
    }
    return Ok(doses);
  }

}
