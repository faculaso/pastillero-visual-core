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
 * El cotejo mira DOS cosas, no solo el instante exacto: además de eso, un
 * día que ya tiene tantas tomas como el esquema predice se considera
 * cubierto aunque los instantes no coincidan. Sin esa segunda regla la
 * idempotencia se cae con cualquier cambio de huso horario — ver
 * `findMissingSlots`.
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

  /** Clave de día en hora LOCAL — es el día que la persona ve en su pastillero, no el día UTC. */
  private static diaLocal(date: Date): string {
    return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
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

    // Y por el mismo motivo hay que subir el otro extremo al FIN del día:
    // el generador produce todos los horarios del último día, incluidos los
    // posteriores a `to`. Preguntando hasta la hora exacta, una toma de la
    // tarde de ese día no figuraba como existente y se volvía a crear.
    const hasta = new Date(to);
    hasta.setHours(23, 59, 59, 999);

    const existingResult = await this.doseRepository.findByTreatmentInRange(treatment.id, desde, hasta);
    if (!existingResult.ok) return existingResult;

    // Cualquier estado cuenta como "ya existe": una toma saltada o no tomada
    // sigue ocupando su lugar en el pastillero y no hay que recrearla.
    const yaExisten = new Set(existingResult.value.map((d) => d.scheduledAt.getTime()));

    // Cuántas tomas hay ya por día. Los horarios del esquema son hora de
    // PARED ("05:30"), y `calculateScheduledDoseTimes` los resuelve con el
    // huso del dispositivo: las mismas 05:30 dan un instante distinto en un
    // teléfono argentino que en uno en GMT. Comparando solo por instante,
    // abrir la app con otro huso no reconocía NINGUNA toma existente y
    // duplicaba la serie entera — dos pastillas donde va una, la adherencia
    // partida al medio y una alarma a una hora equivocada. Pasó de verdad.
    const existentesPorDia = new Map<string, number>();
    for (const dose of existingResult.value) {
      const dia = ExtendDoseHorizonUseCase.diaLocal(dose.scheduledAt);
      existentesPorDia.set(dia, (existentesPorDia.get(dia) ?? 0) + 1);
    }

    // Cuántas predice el esquema para cada día, para poder decir "este día
    // ya está cubierto" sin exigir que los instantes coincidan.
    const previstas = calculateScheduledDoseTimes(treatment.dosageScheme, from, to);
    const previstasPorDia = new Map<string, number>();
    for (const scheduledAt of previstas) {
      const dia = ExtendDoseHorizonUseCase.diaLocal(scheduledAt);
      previstasPorDia.set(dia, (previstasPorDia.get(dia) ?? 0) + 1);
    }

    const slots: Dose[] = [];
    for (const scheduledAt of previstas) {
      if (yaExisten.has(scheduledAt.getTime())) continue;

      const dia = ExtendDoseHorizonUseCase.diaLocal(scheduledAt);
      const yaEnEseDia = existentesPorDia.get(dia) ?? 0;
      if (yaEnEseDia >= (previstasPorDia.get(dia) ?? 0)) continue;

      const slot = createDoseSlot({
        id: this.idGenerator.generate(),
        treatmentId: treatment.id,
        scheduledAt,
      });
      if (!slot.ok) return slot;
      slots.push(slot.value);
      // La recién creada ocupa lugar para las siguientes vueltas del mismo día.
      existentesPorDia.set(dia, yaEnEseDia + 1);
    }
    return Ok(slots);
  }
}
