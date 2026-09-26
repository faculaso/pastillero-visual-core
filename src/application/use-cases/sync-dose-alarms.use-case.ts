import {
  Ok,
  type Result,
  type DomainError,
  DoseStatus,
  type Treatment,
  type DoseRepository,
  type TreatmentRepository,
} from '../../domain';
import type { UseCase } from '../core/use-case';
import type { Clock } from '../ports/clock.port';
import type { NotificationScheduler } from '../ports/notification-scheduler.port';
import type { SyncDoseAlarmsInput, SyncDoseAlarmsOutput } from '../dto/sync-dose-alarms.dto';

/** Mismo horizonte que materializa las tomas: de nada sirve armar más allá de donde hay dosis. */
const DEFAULT_HORIZON_DAYS = 30;

/**
 * Deja este dispositivo con exactamente las alarmas que le corresponden a
 * SU dueño: programa las que faltan y apaga las que sobran.
 *
 * Por qué hace falta. Las alarmas de notifee son locales: viven en el
 * teléfono que las programó, no en la base. Y hasta acá el único momento en
 * que se programaban era al dar de alta un tratamiento o al extender el
 * horizonte — los dos, en el teléfono de quien hiciera la acción. Como el
 * alta es una pantalla del Cuidador, las alarmas de las pastillas del
 * Adulto Mayor terminaban en el teléfono del Cuidador, y en el del Adulto
 * Mayor no quedaba ninguna: cuando abría su app ya no faltaba ninguna toma
 * por crear, así que no programaba nada. Nunca le sonó el teléfono.
 *
 * Las alarmas tampoco sobreviven siempre al dispositivo: medido en el
 * emulador, después de un arranque en frío quedaban CERO programadas. (Lo
 * que sí se comprobó que NO las borra es reinstalar el APK encima: 199
 * antes y 199 después.)
 *
 * Corriendo esto al abrir el pastillero, el teléfono se repara solo: no
 * importa quién creó el tratamiento, desde qué dispositivo se dio de baja,
 * ni si el teléfono se reinició y perdió las alarmas.
 *
 * Compara contra lo que ya está programado y toca SOLO la diferencia
 * (`scheduledDoseIds`). En régimen normal eso es cero llamadas; la pasada
 * cara es la primera después de una actualización, una sola vez.
 *
 * LO QUE NO PUEDE HACER: si el Cuidador carga un tratamiento y el Adulto
 * Mayor no abre la app antes de la primera toma, esa primera alarma no
 * existe. Programar una alarma requiere que el código corra en el teléfono
 * que tiene que sonar, y sin notificaciones push no hay forma de
 * despertarlo desde afuera.
 */
export class SyncDoseAlarmsUseCase implements UseCase<SyncDoseAlarmsInput, SyncDoseAlarmsOutput> {
  constructor(
    private readonly treatmentRepository: TreatmentRepository,
    private readonly doseRepository: DoseRepository,
    private readonly notificationScheduler: NotificationScheduler,
    private readonly clock: Clock,
  ) {}

  async execute(input: SyncDoseAlarmsInput): Promise<Result<SyncDoseAlarmsOutput, DomainError>> {
    const now = this.clock.now();
    const hasta = new Date(now);
    hasta.setDate(hasta.getDate() + (input.horizonDays ?? DEFAULT_HORIZON_DAYS));

    const treatmentsResult = await this.treatmentRepository.findActiveByPatient(input.patientId);
    if (!treatmentsResult.ok) return treatmentsResult;
    const activos = new Map(treatmentsResult.value.map((t) => [t.id, t]));

    // Todas las tomas de la ventana, de cualquier estado: las PENDING dicen
    // qué armar, y las demás qué apagar.
    const dosesResult = await this.doseRepository.findByPatientInRange(input.patientId, now, hasta);
    if (!dosesResult.ok) return dosesResult;
    const enLaVentana = dosesResult.value;

    const deberian = enLaVentana.filter(
      (dose) =>
        dose.status === DoseStatus.PENDING &&
        activos.has(dose.treatmentId) &&
        dose.scheduledAt.getTime() > now.getTime(),
    );
    const deberianIds = new Set(deberian.map((d) => d.id));

    const programadasResult = await this.notificationScheduler.scheduledDoseIds();
    if (!programadasResult.ok) return programadasResult;
    const programadas = new Set(programadasResult.value);

    const alarmWarnings: string[] = [];
    let scheduledCount = 0;
    let cancelledCount = 0;

    for (const dose of deberian) {
      if (programadas.has(dose.id)) continue;
      const treatment = activos.get(dose.treatmentId) as Treatment;
      const result = await this.notificationScheduler.scheduleDoseAlarm(dose, treatment);
      if (result.ok) scheduledCount += 1;
      else alarmWarnings.push(dose.id);
    }

    // Apagar solo alarmas de tomas que EXISTEN en esta ventana y ya no
    // corresponden. Las de más allá del horizonte no se tocan: no se leyeron
    // acá y apagarlas por no encontrarlas sería borrar lo que sí sirve.
    for (const dose of enLaVentana) {
      if (deberianIds.has(dose.id) || !programadas.has(dose.id)) continue;
      const result = await this.notificationScheduler.cancelDoseAlarm(dose.id);
      if (result.ok) cancelledCount += 1;
      else alarmWarnings.push(dose.id);
    }

    return Ok({ scheduledCount, cancelledCount, alarmWarnings });
  }
}
