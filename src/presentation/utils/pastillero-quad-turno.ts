import type { WeekDoseView } from '../../application';
import type { WeekDayBucket } from './group-doses-by-week';

export type QuadTurno = 'morning' | 'midday' | 'afternoon' | 'night';

export interface QuadDayBucket {
  readonly dayIndex: number;
  readonly date: Date;
  readonly morning: readonly WeekDoseView[];
  readonly midday: readonly WeekDoseView[];
  readonly afternoon: readonly WeekDoseView[];
  readonly night: readonly WeekDoseView[];
}

export const QUAD_TURNOS: ReadonlyArray<{ readonly key: QuadTurno; readonly short: string }> = [
  { key: 'morning', short: 'MAÑ' },
  { key: 'midday', short: 'MED' },
  { key: 'afternoon', short: 'TAR' },
  { key: 'night', short: 'NOC' },
];

/**
 * Clasificación de 4 turnos SOLO para el pastillero físico (`WeekGrid`) — el
 * resto de la app sigue clasificando en 3 (`time-of-day-theme.ts`), a
 * propósito: es el corte que ya usan `PastilleroVirtualScreen` y
 * `MiSemanaScreen`, y tocarlo ahí afectaría saludos/temas/agrupación en
 * pantallas que no pidieron este cambio. Acá se re-clasifica cada dosis por
 * su propia hora, partiendo el rango de "tarde" (12-19hs) en mediodía
 * (11-15hs) y tarde (15-19hs) — "mañana" cede su última hora (11hs) a
 * mediodía para que el corte quede parejo con las 4 franjas del pastillero.
 */
export function classifyQuadTurno(date: Date): QuadTurno {
  const hour = date.getHours();
  if (hour >= 5 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 15) return 'midday';
  if (hour >= 15 && hour < 19) return 'afternoon';
  return 'night';
}

/**
 * Reparte los `WeekDoseView` ya agrupados en 3 turnos por día (`groupDosesByWeek`)
 * en 4, sin tocar esa función ni sus consumidores existentes (Cuidador y
 * Adulto Mayor siguen usando la de 3 turnos para lo suyo). Aplana los 3
 * arrays de cada día y reclasifica cada dosis por su `scheduledAt` real.
 */
export function buildQuadBuckets(buckets: readonly WeekDayBucket[]): readonly QuadDayBucket[] {
  return buckets.map((bucket) => {
    const all = [...bucket.morning, ...bucket.afternoon, ...bucket.night];
    const quad: { -readonly [K in QuadTurno]: WeekDoseView[] } = {
      morning: [],
      midday: [],
      afternoon: [],
      night: [],
    };
    for (const dose of all) {
      quad[classifyQuadTurno(dose.scheduledAt)].push(dose);
    }
    return { dayIndex: bucket.dayIndex, date: bucket.date, ...quad };
  });
}
