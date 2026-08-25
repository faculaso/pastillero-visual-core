import type { WeekDoseView } from '../../application';
import { getTimeOfDayTheme, type TimeOfDayPeriod } from './time-of-day-theme';

export interface WeekDayBucket {
  /** 0 = domingo … 6 = sábado, igual que `Date#getDay()`. */
  readonly dayIndex: number;
  readonly date: Date;
  readonly morning: readonly WeekDoseView[];
  readonly afternoon: readonly WeekDoseView[];
  readonly night: readonly WeekDoseView[];
}

const PERIOD_KEY: Record<TimeOfDayPeriod, 'morning' | 'afternoon' | 'night'> = {
  morning: 'morning',
  afternoon: 'afternoon',
  night: 'night',
};

/**
 * Agrupa las dosis de `GetWeeklyScheduleUseCase` en 7 días × 3 turnos, para
 * el pastillero semanal (grilla del Cuidador, lista del Adulto Mayor). Usa
 * el mismo `getTimeOfDayTheme` que ya clasifica "mañana/tarde/noche" en
 * `PastilleroVirtualScreen` — esta app tiene 3 turnos en todos lados, no 4.
 */
export function groupDosesByWeek(doses: readonly WeekDoseView[], weekStart: Date): readonly WeekDayBucket[] {
  const mutable = Array.from({ length: 7 }, (_, dayIndex) => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + dayIndex);
    return { dayIndex, date, morning: [] as WeekDoseView[], afternoon: [] as WeekDoseView[], night: [] as WeekDoseView[] };
  });

  for (const dose of doses) {
    const dayOffset = daysBetween(weekStart, dose.scheduledAt);
    if (dayOffset < 0 || dayOffset > 6) continue; // fuera de la semana pedida, no debería pasar
    const period = PERIOD_KEY[getTimeOfDayTheme(dose.scheduledAt).period];
    mutable[dayOffset]![period].push(dose);
  }

  return mutable;
}

function daysBetween(weekStart: Date, date: Date): number {
  const start = new Date(weekStart);
  start.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
}
