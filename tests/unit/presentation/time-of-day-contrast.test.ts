import { describe, it, expect } from 'vitest';
import { TIME_OF_DAY_THEMES, type TimeOfDayTheme } from '../../../src/presentation/utils/time-of-day-theme';
import { composite, contrastRatio, toHex } from '../../helpers/contrast';

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

const THEMES: ReadonlyArray<readonly [string, TimeOfDayTheme]> = (
  ['claro', 'oscuro'] as const
).flatMap((esquema) =>
  (['morning', 'afternoon', 'night'] as const).map(
    (turno) => [`${turno} (${esquema})`, TIME_OF_DAY_THEMES[esquema][turno]] as const,
  ),
);

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
