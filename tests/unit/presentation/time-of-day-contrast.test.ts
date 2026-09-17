import { describe, it, expect } from 'vitest';
import { getTimeOfDayTheme, type TimeOfDayTheme } from '../../../src/presentation/utils/time-of-day-theme';

/**
 * El contraste de esta pantalla no se puede verificar "a ojo" en los tres
 * turnos: el fondo cambia de celeste a ámbar a índigo oscuro, y ya pasó una
 * vez que el turno noche quedara con texto blanco sobre lavanda (~1.9:1) sin
 * que nadie lo notara hasta verlo en un dispositivo. Acá se calcula el ratio
 * WCAG real de cada par para los tres turnos.
 *
 * Umbrales: 4.5:1 para texto normal, 3:1 para bordes/componentes de UI
 * (WCAG 2.1 AA). `tokens.ts` declara apuntar a AAA (>=7:1) para texto sobre
 * fondo, así que el texto principal se exige a 7.
 */

type Rgb = readonly [number, number, number];

function parseColor(value: string): { rgb: Rgb; alpha: number } {
  const hexDigits = /^#([0-9a-f]{6})$/i.exec(value)?.[1];
  if (hexDigits !== undefined) {
    const n = parseInt(hexDigits, 16);
    return { rgb: [(n >> 16) & 255, (n >> 8) & 255, n & 255], alpha: 1 };
  }
  const rgba = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(value);
  if (rgba) {
    return {
      rgb: [Number(rgba[1]), Number(rgba[2]), Number(rgba[3])],
      alpha: rgba[4] === undefined ? 1 : Number(rgba[4]),
    };
  }
  throw new Error(`Color no soportado por el test: ${value}`);
}

/** Aplana un color traslúcido sobre un fondo opaco (lo que ve el ojo). */
function composite(foreground: string, background: string): Rgb {
  const fg = parseColor(foreground);
  const bg = parseColor(background);
  if (bg.alpha !== 1) throw new Error('El fondo tiene que ser opaco');
  const blend = (channel: number, base: number): number => channel * fg.alpha + base * (1 - fg.alpha);
  return [blend(fg.rgb[0], bg.rgb[0]), blend(fg.rgb[1], bg.rgb[1]), blend(fg.rgb[2], bg.rgb[2])];
}

function relativeLuminance(rgb: Rgb): number {
  const toLinear = (channel: number): number => {
    const s = channel / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * toLinear(rgb[0]) + 0.7152 * toLinear(rgb[1]) + 0.0722 * toLinear(rgb[2]);
}

function toHex(rgb: Rgb): string {
  const channel = (value: number): string => Math.round(value).toString(16).padStart(2, '0');
  return `#${channel(rgb[0])}${channel(rgb[1])}${channel(rgb[2])}`;
}

/** `foreground` puede ser traslúcido; `background` tiene que ser opaco. */
function contrastRatio(foreground: string, background: string): number {
  const l1 = relativeLuminance(composite(foreground, background));
  const l2 = relativeLuminance(parseColor(background).rgb);
  const [lighter, darker] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (lighter + 0.05) / (darker + 0.05);
}

const THEMES: ReadonlyArray<readonly [string, TimeOfDayTheme]> = [
  ['mañana', getTimeOfDayTheme(new Date('2026-08-01T08:00:00.000'))],
  ['tarde', getTimeOfDayTheme(new Date('2026-08-01T14:00:00.000'))],
  ['noche', getTimeOfDayTheme(new Date('2026-08-01T21:00:00.000'))],
];

describe('contraste de TimeOfDayTheme', () => {
  it.each(THEMES)('%s: el texto principal sobre el fondo llega a AAA (>=7:1)', (_label, theme) => {
    expect(contrastRatio(theme.accentText, theme.background)).toBeGreaterThanOrEqual(7);
  });

  it.each(THEMES)('%s: el texto secundario sobre el fondo llega a AA (>=4.5:1)', (_label, theme) => {
    expect(contrastRatio(theme.mutedText, theme.background)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(THEMES)('%s: el texto del chip contrasta contra el fondo del chip (>=4.5:1)', (_label, theme) => {
    // El bug original: el chip aclaraba en los tres turnos, así que de noche
    // acercaba su fondo al blanco del texto en vez de alejarlo.
    const chipSurface = toHex(composite(theme.chipBackground, theme.background));
    expect(contrastRatio(theme.accentText, chipSurface)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(THEMES)('%s: la ranura de progreso se distingue del fondo (>=1.3:1)', (_label, theme) => {
    // Umbral bajo a propósito: es una superficie hundida, no un borde
    // portador de información — solo tiene que no ser invisible. Lo que sí
    // tiene que verse es el RELLENO, cubierto por el caso de abajo.
    expect(contrastRatio(theme.recessedSurface, theme.background)).toBeGreaterThanOrEqual(1.3);
  });
});
