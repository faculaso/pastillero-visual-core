import { DosageFrequency } from '../enums/treatment.enums';
import type { DosageScheme } from '../entities/dosage-scheme.entity';
import type { TimeOfDay } from '../value-objects/time-of-day.vo';

function atTime(day: Date, time: TimeOfDay): Date {
  const d = new Date(day);
  d.setHours(time.hour, time.minute, 0, 0);
  return d;
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Materializa un `DosageScheme` en fechas concretas de toma dentro de
 * `[from, to]`, acotado también por `scheme.startDate`/`scheme.endDate`
 * (CU-01 postcondición: "slots creados"). Función pura y determinística:
 * no genera ids ni persiste — eso es responsabilidad de la capa de
 * aplicación (`RegisterTreatmentUseCase`).
 *
 * `AS_NEEDED` retorna siempre `[]`: no hay horario fijo que materializar,
 * las tomas de ese tipo se crean manualmente, fuera de este flujo.
 */
export function calculateScheduledDoseTimes(
  scheme: DosageScheme,
  from: Date,
  to: Date,
): readonly Date[] {
  if (scheme.frequency === DosageFrequency.AS_NEEDED) {
    return [];
  }

  const rangeStart = new Date(Math.max(startOfDay(from).getTime(), startOfDay(scheme.startDate).getTime()));
  const rangeEndCandidate = scheme.endDate
    ? new Date(Math.min(startOfDay(to).getTime(), startOfDay(scheme.endDate).getTime()))
    : startOfDay(to);

  if (rangeStart.getTime() > rangeEndCandidate.getTime()) {
    return [];
  }

  const result: Date[] = [];
  const cursor = new Date(rangeStart);

  while (cursor.getTime() <= rangeEndCandidate.getTime()) {
    const dayIncluded = isDayIncluded(scheme, cursor, rangeStart);
    if (dayIncluded) {
      for (const time of scheme.timesOfDay) {
        result.push(atTime(cursor, time));
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return result;
}

function isDayIncluded(scheme: DosageScheme, day: Date, rangeStart: Date): boolean {
  switch (scheme.frequency) {
    case DosageFrequency.DAILY:
      return true;
    case DosageFrequency.SPECIFIC_WEEKDAYS:
      return scheme.weekdays?.includes(day.getDay()) ?? false;
    case DosageFrequency.CUSTOM_INTERVAL_DAYS: {
      const interval = scheme.intervalDays ?? 1;
      const diffDays = Math.round((day.getTime() - rangeStart.getTime()) / 86_400_000);
      return diffDays % interval === 0;
    }
    case DosageFrequency.AS_NEEDED:
      return false;
  }
}
