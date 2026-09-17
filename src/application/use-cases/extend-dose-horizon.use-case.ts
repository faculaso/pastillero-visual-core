import {
  Ok,
  type Result,
  type DomainError,
  type Dose,
  type Treatment,
  type DoseRepository,
  type TreatmentRepository,
  calculateScheduledDoseTimes,
  createDoseSlot,
} from '../../domain';
import type { UseCase } from '../core/use-case';
import type { Clock } from '../ports/clock.port';
import type { IdGenerator } from '../ports/id-generator.port';
import type { NotificationScheduler } from '../ports/notification-scheduler.port';
import type { ExtendDoseHorizonInput, ExtendDoseHorizonOutput } from '../dto/extend-dose-horizon.dto';

/** Mismo horizonte que usa `RegisterTreatmentUseCase` al dar de alta. */
const DEFAULT_HORIZON_DAYS = 30;

/**
 * Mantiene vivo el pastillero de un tratamiento crónico.
 *
 * `RegisterTreatmentUseCase` materializa 30 días de tomas UNA sola vez, al
 * dar de alta, y hasta ahora nada las volvía a generar. A los 30 días un
 * tratamiento sin fecha de fin simplemente se apagaba: dejaba de sonar la
 * alarma y el pastillero quedaba vacío, sin ningún aviso. Lo que hacía el
 * Cuidador entonces era volver a cargar el mismo medicamento — de ahí los
 * tratamientos duplicados, con su adherencia partida en dos y las tomas del
 * viejo contando como incumplidas para siempre.
 *
 * Es IDEMPOTENTE: compara contra las tomas que ya existen y crea solo las
 * que faltan, así que correrlo en cada arranque no duplica nada. El caso
 * normal es que no cree ninguna y no escriba en la base.
 *
 * Los tratamientos con fecha de fin no se ven afectados:
 * `calculateScheduledDoseTimes` ya corta en `endDate`, así que un
 * tratamiento terminado no genera nada por más veces que esto corra.
 *
 * LÍMITE CONOCIDO: el cotejo es por horario exacto. Si alguna vez se
 * reprograma la hora de una toma ya creada (la función SQL
 * `reschedule_treatment_time`), esa toma dejaría de coincidir con el
 * horario que el esquema predice y esta pasada crearía una nueva en el
 * horario viejo. Mientras no exista esa pantalla no puede pasar; cuando
 * exista, el cotejo tiene que mirar el día y no el instante.
 */
export class ExtendDoseHorizonUseCase
  implements UseCase<ExtendDoseHorizonInput, ExtendDoseHorizonOutput>
{
  constructor(
    private readonly treatmentRepository: TreatmentRepository,
    private readonly doseRepository: DoseRepository,
    private readonly notificationScheduler: NotificationScheduler,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(input: ExtendDoseHorizonInput): Promise<Result<ExtendDoseHorizonOutput, DomainError>> {
    const now = this.clock.now();
    const horizonEnd = new Date(now);
    horizonEnd.setDate(horizonEnd.getDate() + (input.horizonDays ?? DEFAULT_HORIZON_DAYS));

    const treatmentsResult = await this.treatmentRepository.findActiveByPatient(input.patientId);
    if (!treatmentsResult.ok) return treatmentsResult;

    let createdCount = 0;
    const alarmWarnings: string[] = [];

    for (const treatment of treatmentsResult.value) {
      const missingResult = await this.findMissingSlots(treatment, now, horizonEnd);
      if (!missingResult.ok) return missingResult;
      if (missingResult.value.length === 0) continue;

      const persisted = await this.doseRepository.createSlots(missingResult.value);
      if (!persisted.ok) return persisted;
      createdCount += persisted.value.length;

      // Sin esto las tomas nuevas existirían pero no sonarían: un pastillero
      // que se ve bien y nunca avisa es peor que uno vacío.
      for (const dose of persisted.value) {
        const scheduled = await this.notificationScheduler.scheduleDoseAlarm(dose, treatment);
        if (!scheduled.ok) alarmWarnings.push(dose.id);
      }
    }

    return Ok({ createdCount, alarmWarnings });
  }

  private async findMissingSlots(
    treatment: Treatment,
    from: Date,
    to: Date,
  ): Promise<Result<readonly Dose[], DomainError>> {
    // La consulta de lo que YA existe tiene que cubrir exactamente el mismo
    // tramo que el generador puede producir, y `calculateScheduledDoseTimes`
    // baja `from` al comienzo del día. Preguntando desde la hora exacta, la
    // toma de HOY más temprano que "ahora" quedaba fuera del resultado y la
    // pasada siguiente la volvía a crear: la idempotencia se rompía sola una
    // vez por día. Lo encontró el test de correrlo dos veces.
    const desde = new Date(from);
    desde.setHours(0, 0, 0, 0);

    const existingResult = await this.doseRepository.findByTreatmentInRange(treatment.id, desde, to);
    if (!existingResult.ok) return existingResult;

    // Cualquier estado cuenta como "ya existe": una toma saltada o no tomada
    // sigue ocupando su lugar en el pastillero y no hay que recrearla.
    const yaExisten = new Set(existingResult.value.map((d) => d.scheduledAt.getTime()));

    const slots: Dose[] = [];
    for (const scheduledAt of calculateScheduledDoseTimes(treatment.dosageScheme, from, to)) {
      if (yaExisten.has(scheduledAt.getTime())) continue;
      const slot = createDoseSlot({
        id: this.idGenerator.generate(),
        treatmentId: treatment.id,
        scheduledAt,
      });
      if (!slot.ok) return slot;
      slots.push(slot.value);
    }
    return Ok(slots);
  }
}
