import {
  Ok,
  Err,
  type Result,
  DomainErrors,
  type DomainError,
  DoseStatus,
  TreatmentStatus,
  transitionTreatmentStatus,
  type Treatment,
  type DoseRepository,
  type TreatmentRepository,
} from '../../domain';
import type { UseCase } from '../core/use-case';
import type { Clock } from '../ports/clock.port';
import type { NotificationScheduler } from '../ports/notification-scheduler.port';
import type {
  ChangeTreatmentStatusInput,
  ChangeTreatmentStatusOutput,
} from '../dto/change-treatment-status.dto';

/**
 * Ventana de tomas futuras a la que se le apagan (o se le vuelven a
 * encender) las alarmas. `ExtendDoseHorizonUseCase` materializa 30 días,
 * así que con esto sobra; se toma holgado a propósito porque el costo es
 * una sola consulta por tratamiento y el precio de quedarse corto es un
 * teléfono que sigue sonando por un remedio que el médico suspendió.
 */
const FUTURE_DOSES_WINDOW_DAYS = 400;

/**
 * Pausar, reanudar o dar de baja un tratamiento (CU-03).
 *
 * Era el agujero funcional más grande del lado del Cuidador: si el médico
 * suspendía un remedio, no había absolutamente nada en la app que lo
 * apagara. El tratamiento seguía generando tomas, el pastillero las seguía
 * mostrando y el teléfono seguía sonando. La única salida era borrarlo, y
 * borrar se lleva puesto el historial de adherencia.
 *
 * Tiene una ironía que conviene dejar escrita: el dominio ya definía la
 * matriz `VALID_TREATMENT_TRANSITIONS` y `transitionTreatmentStatus` desde
 * el principio, y las consultas de pastillero ya filtran por tratamiento
 * activo — faltaba solamente el caso de uso que uniera las dos puntas.
 *
 * Las ALARMAS son la mitad que importa. Cambiar el estado en la base y
 * dejar las notificaciones programadas es peor que no hacer nada: el
 * Cuidador ve el tratamiento dado de baja y el Adulto Mayor lo sigue
 * escuchando sonar, sin encontrarlo por ningún lado en el pastillero.
 *
 * LO QUE NO HACE: borrar las tomas PENDING ya generadas. Quedan en la base
 * (tal como documenta la migración `0006_reschedule_and_cancel_treatment`),
 * calladas, porque el pastillero ya no muestra tomas de tratamientos
 * inactivos. Se mantienen a propósito: si mañana el tratamiento se reanuda,
 * su semana vuelve intacta, y el historial del período pausado no se
 * falsea con tomas que desaparecen.
 */
export class ChangeTreatmentStatusUseCase
  implements UseCase<ChangeTreatmentStatusInput, ChangeTreatmentStatusOutput>
{
  constructor(
    private readonly treatmentRepository: TreatmentRepository,
    private readonly doseRepository: DoseRepository,
    private readonly notificationScheduler: NotificationScheduler,
    private readonly clock: Clock,
  ) {}

  async execute(
    input: ChangeTreatmentStatusInput,
  ): Promise<Result<ChangeTreatmentStatusOutput, DomainError>> {
    const treatmentResult = await this.treatmentRepository.findById(input.treatmentId);
    if (!treatmentResult.ok) return treatmentResult;
    const treatment = treatmentResult.value;
    if (!treatment) return Err(DomainErrors.treatmentNotFound(input.treatmentId));

    if (treatment.caregiverId !== input.requestingCaregiverId) {
      return Err(DomainErrors.unauthorizedActor(input.requestingCaregiverId, 'changeTreatmentStatus'));
    }

    const now = this.clock.now();

    // El dominio decide si la transición es legal (p. ej. un tratamiento ya
    // dado de baja no se reanuda). Se valida ANTES de tocar ninguna alarma.
    const transitioned = transitionTreatmentStatus(treatment, input.newStatus, now);
    if (!transitioned.ok) return transitioned;

    const persisted = await this.treatmentRepository.update(transitioned.value);
    if (!persisted.ok) return persisted;

    // Las alarmas van DESPUÉS de persistir y son best-effort: si el SO
    // rechaza una, el tratamiento igual quedó dado de baja — el estado
    // manda, y la pantalla avisa lo que no se pudo apagar.
    const alarms = await this.syncFutureAlarms(persisted.value, now);

    return Ok({ treatment: persisted.value, ...alarms });
  }

  /**
   * Apaga las alarmas futuras si el tratamiento dejó de estar activo, y las
   * vuelve a programar si se reanudó. Solo mira tomas PENDING: una toma ya
   * confirmada o vencida no tiene alarma viva que apagar.
   */
  private async syncFutureAlarms(
    treatment: Treatment,
    now: Date,
  ): Promise<{ alarmsAffected: number; alarmWarnings: readonly string[] }> {
    const hasta = new Date(now);
    hasta.setDate(hasta.getDate() + FUTURE_DOSES_WINDOW_DAYS);

    const dosesResult = await this.doseRepository.findByTreatmentInRange(treatment.id, now, hasta);
    // Una lectura fallida acá no invalida el cambio de estado, que ya está
    // guardado: se reporta como "ninguna alarma tocada" y sigue.
    if (!dosesResult.ok) return { alarmsAffected: 0, alarmWarnings: [] };

    const pendientes = dosesResult.value.filter(
      (dose) => dose.status === DoseStatus.PENDING && dose.scheduledAt.getTime() > now.getTime(),
    );

    const reanudando = treatment.status === TreatmentStatus.ACTIVE;
    const alarmWarnings: string[] = [];
    let alarmsAffected = 0;

    for (const dose of pendientes) {
      const result = reanudando
        ? await this.notificationScheduler.scheduleDoseAlarm(dose, treatment)
        : await this.notificationScheduler.cancelDoseAlarm(dose.id);
      if (result.ok) alarmsAffected += 1;
      else alarmWarnings.push(dose.id);
    }

    return { alarmsAffected, alarmWarnings };
  }
}
