import {
  Ok,
  type Result,
  DoseStatus,
  StockAlertLevel,
  calculateStockAlertLevel,
  type DomainError,
  type DoseRepository,
  type TreatmentRepository,
} from '../../domain';
import type { UseCase } from '../core/use-case';
import type { Clock } from '../ports/clock.port';
import type {
  GetWeeklyScheduleInput,
  GetWeeklyScheduleOutput,
  WeekDoseView,
  TreatmentStockSummary,
} from '../dto/get-weekly-schedule.dto';

/**
 * Todo lo que necesita el pastillero semanal (Cuidador y Adulto Mayor) en
 * una sola query: las tomas de la semana YA resueltas contra su tratamiento
 * (nombre/perfil visual), más qué tratamientos necesitan reponer stock. El
 * join va al revés que en `GetPendingDosesForPatientUseCase` (que hace N+1
 * porque parte de las dosis) — acá se trae primero `findActiveByPatient`
 * (una sola query) y se arma un mapa, evitando pedir el mismo tratamiento
 * repetido por cada una de sus ~7-28 dosis de la semana.
 */
export class GetWeeklyScheduleUseCase
  implements UseCase<GetWeeklyScheduleInput, GetWeeklyScheduleOutput>
{
  constructor(
    private readonly doseRepository: DoseRepository,
    private readonly treatmentRepository: TreatmentRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: GetWeeklyScheduleInput): Promise<Result<GetWeeklyScheduleOutput, DomainError>> {
    const now = this.clock.now();
    const { weekStart, weekEnd } = resolveWeekBounds(input.weekStart ?? now);

    const treatmentsResult = await this.treatmentRepository.findActiveByPatient(input.patientId);
    if (!treatmentsResult.ok) return treatmentsResult;
    const treatmentById = new Map(treatmentsResult.value.map((t) => [t.id, t] as const));

    const dosesResult = await this.doseRepository.findByPatientInRange(input.patientId, weekStart, weekEnd);
    if (!dosesResult.ok) return dosesResult;

    const doses: WeekDoseView[] = [];
    for (const dose of dosesResult.value) {
      const treatment = treatmentById.get(dose.treatmentId);
      // Tratamiento pausado/cancelado desde que se generó el slot: no se
      // muestra en la semana activa (no hay nada más que el Cuidador o el
      // Adulto Mayor puedan hacer con una dosis de un tratamiento inactivo).
      if (!treatment) continue;
      doses.push({
        doseId: dose.id,
        treatmentId: dose.treatmentId,
        medicationName: treatment.medication.name,
        visualProfile: treatment.visualProfile,
        scheduledAt: dose.scheduledAt,
        status: dose.status,
      });
    }

    const treatmentsNeedingAttention: TreatmentStockSummary[] = [];
    for (const treatment of treatmentsResult.value) {
      const level = calculateStockAlertLevel(treatment.stock);
      if (level === StockAlertLevel.WARNING || level === StockAlertLevel.CRITICAL) {
        treatmentsNeedingAttention.push({
          treatmentId: treatment.id,
          medicationName: treatment.medication.name,
          stockAlertLevel: level,
        });
      }
    }

    const pastDoses = doses.filter((d) => d.scheduledAt.getTime() <= now.getTime());
    const adherencePercentage =
      pastDoses.length === 0
        ? 100
        : Math.round((pastDoses.filter((d) => d.status === DoseStatus.TAKEN).length / pastDoses.length) * 100);

    return Ok({ weekStart, weekEnd, doses, treatmentsNeedingAttention, adherencePercentage });
  }
}

/** Semana domingo 00:00 -> sábado 23:59:59.999 (`Date#getDay()`: 0 = domingo), no ISO/lunes-primero. */
function resolveWeekBounds(reference: Date): { weekStart: Date; weekEnd: Date } {
  const weekStart = new Date(reference);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  return { weekStart, weekEnd };
}
