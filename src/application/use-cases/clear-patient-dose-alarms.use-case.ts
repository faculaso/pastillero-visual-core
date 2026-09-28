import { Ok, type Result, type DomainError, type DoseRepository } from '../../domain';
import type { UseCase } from '../core/use-case';
import type { Clock } from '../ports/clock.port';
import type { NotificationScheduler } from '../ports/notification-scheduler.port';
import type { ClearPatientDoseAlarmsInput, ClearPatientDoseAlarmsOutput } from '../dto/clear-patient-dose-alarms.dto';

/** Mismo horizonte que materializa las tomas: más allá no hay nada que mirar. */
const DEFAULT_HORIZON_DAYS = 30;

/**
 * Apaga en ESTE dispositivo las alarmas de las tomas de las personas a las
 * que sólo se supervisa.
 *
 * `SyncDoseAlarmsUseCase` ya barre esto, pero corre en una sola pantalla: el
 * pastillero del Adulto Mayor. Un teléfono que entra únicamente como
 * Cuidador no la abre nunca, así que las alarmas que la versión vieja le
 * programó —las pastillas de otra persona, que él no se toma— le siguen
 * sonando para siempre y no hay ninguna pantalla que las limpie. Ese es el
 * síntoma que se reportó desde el primer día: al Cuidador le suena el
 * teléfono a la hora de la medicación de quien cuida.
 *
 * Por qué apunta a pacientes concretos en vez de borrar todo. Una misma
 * cuenta puede tener los dos roles y alternarlos en el mismo teléfono. Si al
 * entrar como Cuidador se cancelara todo, la persona se quedaría sin SUS
 * alarmas hasta la próxima vez que abriera su pastillero — en una app de
 * medicación eso es peor que el problema que arregla. Yendo por los ids de
 * las tomas de los supervisados, lo propio nunca se toca: el dominio no deja
 * que alguien sea su propio cuidador (`CANNOT_LINK_TO_SELF`), así que un
 * paciente vinculado es, por construcción, otra persona.
 *
 * Si el dispositivo no tiene ninguna alarma armada —el caso normal de un
 * Cuidador— termina sin consultar la base ni una vez.
 *
 * LO QUE NO PUEDE HACER: las alarmas de un paciente que ya se desvinculó no
 * salen en ninguna consulta, así que no hay forma de reconocerlas. Y las que
 * suenan más allá del horizonte se dejan para una pasada futura, cuando el
 * tiempo las traiga adentro de la ventana.
 */
export class ClearPatientDoseAlarmsUseCase
  implements UseCase<ClearPatientDoseAlarmsInput, ClearPatientDoseAlarmsOutput>
{
  constructor(
    private readonly doseRepository: DoseRepository,
    private readonly notificationScheduler: NotificationScheduler,
    private readonly clock: Clock,
  ) {}

  async execute(input: ClearPatientDoseAlarmsInput): Promise<Result<ClearPatientDoseAlarmsOutput, DomainError>> {
    const programadasResult = await this.notificationScheduler.scheduledDoseAlarms();
    if (!programadasResult.ok) return programadasResult;
    const programadas = programadasResult.value;
    if (programadas.length === 0 || input.patientIds.length === 0) {
      return Ok({ cancelledCount: 0, alarmWarnings: [] });
    }

    const now = this.clock.now();
    const hasta = new Date(now);
    hasta.setDate(hasta.getDate() + (input.horizonDays ?? DEFAULT_HORIZON_DAYS));

    // De cualquier estado: una alarma sobra igual si la toma se confirmó.
    const ajenas = new Set<string>();
    for (const patientId of input.patientIds) {
      const dosesResult = await this.doseRepository.findByPatientInRange(patientId, now, hasta);
      if (!dosesResult.ok) return dosesResult;
      for (const dose of dosesResult.value) ajenas.add(dose.id);
    }

    const alarmWarnings: string[] = [];
    let cancelledCount = 0;
    for (const alarma of programadas) {
      if (!ajenas.has(alarma.doseId)) continue;
      const result = await this.notificationScheduler.cancelDoseAlarm(alarma.doseId);
      if (result.ok) cancelledCount += 1;
      else alarmWarnings.push(alarma.doseId);
    }

    return Ok({ cancelledCount, alarmWarnings });
  }
}
