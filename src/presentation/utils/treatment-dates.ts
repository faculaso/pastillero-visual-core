/**
 * Fechas de inicio y fin de un tratamiento, a partir de lo que se elige en
 * el formulario de alta.
 *
 * Hasta ahora `RegisterTreatmentScreen` mandaba `startDate: new Date()`
 * fijo y NUNCA un `endDate`, aunque el dominio y el DTO ya soportaban los
 * dos. Consecuencia: todo tratamiento nacía crónico, y como
 * `RegisterTreatmentUseCase` materializa 30 días de dosis de una sola vez,
 * un antibiótico "por 7 días" generaba 23 tomas fantasma que sonaban la
 * alarma y contaban como incumplidas en la adherencia.
 *
 * Se elige por DURACIÓN y no por fecha de calendario a propósito: las
 * indicaciones médicas se escriben así ("tomar por 7 días"), y evita que
 * alguien tenga que calcular a mano en qué día cae el final — que es
 * justamente donde se cuelan los errores.
 */

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export interface TreatmentDates {
  readonly startDate: Date;
  /** `undefined` = tratamiento crónico, sin fecha de fin. */
  readonly endDate?: Date;
}

/**
 * @param startOffsetDays 0 = hoy, 1 = mañana, etc.
 * @param durationDays `null` = crónico. El rango es INCLUSIVO en los dos
 *   extremos, así que "7 días" desde hoy termina el día 6 contando desde 0:
 *   `calculateScheduledDoseTimes` recorre `cursor <= endDate`.
 */
export function buildTreatmentDates(
  now: Date,
  startOffsetDays: number,
  durationDays: number | null,
): TreatmentDates {
  const startDate = startOfDay(now);
  startDate.setDate(startDate.getDate() + startOffsetDays);

  if (durationDays === null) return { startDate };

  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + durationDays - 1);
  return { startDate, endDate };
}

const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'] as const;

/** Rótulo del chip de inicio: los dos primeros días se nombran, el resto lleva día y número. */
export function formatStartDayLabel(now: Date, offsetDays: number): string {
  if (offsetDays === 0) return 'Hoy';
  if (offsetDays === 1) return 'Mañana';

  const date = startOfDay(now);
  date.setDate(date.getDate() + offsetDays);
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()}`;
}

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
] as const;

const DIAS_LARGOS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'] as const;

function nombrarFecha(date: Date): string {
  return `${DIAS_LARGOS[date.getDay()]} ${date.getDate()} de ${MESES[date.getMonth()]}`;
}

/**
 * Traduce la elección de chips a la frase que confirma qué se va a
 * programar. Sin esto hay que calcular de cabeza en qué día cae el final
 * de "7 días desde el sábado" — exactamente el margen de error que los
 * chips vinieron a sacar.
 */
export function formatTreatmentPeriod(
  now: Date,
  startOffsetDays: number,
  durationDays: number | null,
): string {
  const { startDate, endDate } = buildTreatmentDates(now, startOffsetDays, durationDays);
  const desde = startOffsetDays === 0 ? 'hoy' : nombrarFecha(startDate);

  if (!endDate) return `Desde ${desde}, sin fecha de fin.`;
  return `Desde ${desde} hasta el ${nombrarFecha(endDate)}.`;
}
