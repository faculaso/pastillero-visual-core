import {
  Ok,
  Err,
  type Result,
  DomainErrors,
  TreatmentStatus,
  type DomainError,
  type DoseRepository,
  type TreatmentRepository,
  type ProfileRepository,
} from '../../domain';
import type { UseCase } from '../core/use-case';
import type { Clock } from '../ports/clock.port';
import type { GetPendingDosesInput, GetPendingDosesOutput, PendingDoseView } from '../dto/get-pending-doses.dto';

/**
 * Query de solo lectura (no es un CU del DCU en sí mismo, sino el paso 3 de
 * CU-02: "El sistema renderiza el pastillero del turno"). Se separa de
 * `ConfirmDoseUseCase` porque ese asume `doseId` ya conocido — la pantalla
 * necesita descubrir CUÁL toma mostrar antes de poder confirmarla.
 *
 * Hace un N+1 controlado (una consulta de treatment por dose pendiente):
 * aceptable para el volumen típico de un pastillero (2-6 tomas/día), no
 * amerita una query SQL con JOIN dedicada en esta etapa. Si el volumen
 * creciera (varios tratamientos simultáneos), este es el primer lugar a
 * optimizar con una query de agregación en el repo.
 *
 * El nombre de quien cargó cada tratamiento se resuelve aparte y se
 * memoiza por cuidador dentro de la misma llamada: un pastillero entero
 * suele venir de una o dos personas, así que son una o dos consultas, no
 * una por toma.
 */
export class GetPendingDosesForPatientUseCase
  implements UseCase<GetPendingDosesInput, GetPendingDosesOutput>
{
  constructor(
    private readonly doseRepository: DoseRepository,
    private readonly treatmentRepository: TreatmentRepository,
    private readonly clock: Clock,
    private readonly profileRepository: ProfileRepository,
  ) {}

  /**
   * Best-effort a propósito: si no se puede resolver el nombre, la toma se
   * muestra igual sin esa línea. Que el pastillero no abra porque no se
   * pudo leer un nombre sería cambiar un dato accesorio por el dato que la
   * persona necesita para tomar su medicación.
   */
  private async resolverNombre(
    caregiverId: string,
    cache: Map<string, string | null>,
  ): Promise<string | null> {
    const enCache = cache.get(caregiverId);
    if (enCache !== undefined) return enCache;

    const result = await this.profileRepository.findById(caregiverId);
    const nombre = result.ok ? (result.value?.displayName?.trim() || null) : null;
    cache.set(caregiverId, nombre);
    return nombre;
  }

  async execute(input: GetPendingDosesInput): Promise<Result<GetPendingDosesOutput, DomainError>> {
    const date = input.date ?? this.clock.now();

    const dosesResult = await this.doseRepository.findPendingByPatientAndDate(input.patientId, date);
    if (!dosesResult.ok) return dosesResult;

    const views: PendingDoseView[] = [];
    const nombresPorCuidador = new Map<string, string | null>();
    for (const dose of dosesResult.value) {
      const treatmentResult = await this.treatmentRepository.findById(dose.treatmentId);
      if (!treatmentResult.ok) return treatmentResult;
      const treatment = treatmentResult.value;
      if (!treatment) return Err(DomainErrors.treatmentNotFound(dose.treatmentId));

      // Cancelar o pausar un tratamiento NO borra las dosis PENDING que ya
      // se habían generado (las crea `RegisterTreatmentUseCase` de una vez,
      // con 30 días de horizonte, y nada las limpia después). Sin este
      // filtro la app le sigue diciendo al paciente que tome un medicamento
      // que el Cuidador ya dio de baja — el peor error posible acá, y
      // además deja la pantalla en desacuerdo con `GetWeeklyScheduleUseCase`,
      // que sí parte de `findActiveByPatient`.
      if (treatment.status !== TreatmentStatus.ACTIVE) continue;

      views.push({
        doseId: dose.id,
        treatmentId: dose.treatmentId,
        scheduledAt: dose.scheduledAt,
        medicationName: treatment.medication.name,
        visualProfile: treatment.visualProfile,
        dosagePerTake: treatment.dosageScheme.dosagePerTake,
        caregiverName: await this.resolverNombre(treatment.caregiverId, nombresPorCuidador),
      });
    }

    // Orden por horario: la pantalla siempre muestra primero "el turno" más próximo/vencido.
    views.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());

    return Ok({ doses: views });
  }
}
