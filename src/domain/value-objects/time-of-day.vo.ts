/**
 * Value Object: hora del día en formato 24h, independiente de zona horaria y
 * de la fecha calendario. Se usa como plantilla recurrente del esquema
 * posológico; la materialización a `Date` concreto ocurre al generar `Dose`.
 */
export interface TimeOfDay {
  readonly hour: number; // 0-23
  readonly minute: number; // 0-59
}

export function timeOfDayToMinutes(t: TimeOfDay): number {
  return t.hour * 60 + t.minute;
}

export function compareTimeOfDay(a: TimeOfDay, b: TimeOfDay): number {
  return timeOfDayToMinutes(a) - timeOfDayToMinutes(b);
}
