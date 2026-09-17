import { describe, it, expect } from 'vitest';
import { AdherenceLevel, calculateAdherenceLevel } from '../../../src/domain';
import { getAdherenceDisplay, formatAdherencePercentage } from '../../../src/presentation/utils/adherence-display';
import { colors } from '../../../src/presentation/design-system/tokens';

/**
 * El bug que motivó todo esto: el tablero del Cuidador pintaba el
 * porcentaje de adherencia SIEMPRE de `colors.success`. Un 4.17% (1 de 24
 * tomas, caso real visto en el emulador) salía del mismo verde
 * tranquilizador que un 100%, justo en la pantalla que existe para avisar
 * que algo anda mal.
 */
describe('nivel de adherencia', () => {
  it('80% o más es cumplimiento — el umbral convencional', () => {
    expect(calculateAdherenceLevel(100)).toBe(AdherenceLevel.GOOD);
    expect(calculateAdherenceLevel(80)).toBe(AdherenceLevel.GOOD);
  });

  it('entre 50 y 80 es irregular', () => {
    expect(calculateAdherenceLevel(79.9)).toBe(AdherenceLevel.PARTIAL);
    expect(calculateAdherenceLevel(50)).toBe(AdherenceLevel.PARTIAL);
  });

  it('por debajo de 50 el tratamiento prácticamente no se está haciendo', () => {
    expect(calculateAdherenceLevel(49.9)).toBe(AdherenceLevel.POOR);
    expect(calculateAdherenceLevel(4.17)).toBe(AdherenceLevel.POOR);
    expect(calculateAdherenceLevel(0)).toBe(AdherenceLevel.POOR);
  });
});

describe('getAdherenceDisplay', () => {
  it('NUNCA pinta de verde un porcentaje que no es bueno', () => {
    for (const porcentaje of [0, 4.17, 11, 49.9, 50, 79.9]) {
      expect(getAdherenceDisplay(porcentaje).color).not.toBe(colors.success);
    }
  });

  it('usa el rojo crítico cuando casi no se está tomando', () => {
    expect(getAdherenceDisplay(4.17).color).toBe(colors.critical);
  });

  it('siempre acompaña el color con un rótulo en texto — el color nunca viaja solo', () => {
    for (const porcentaje of [0, 30, 65, 95]) {
      expect(getAdherenceDisplay(porcentaje).label.length).toBeGreaterThan(0);
    }
  });

  it('cada nivel tiene un rótulo distinto: no alcanza con que haya texto, tiene que distinguir', () => {
    const rotulos = new Set([0, 65, 95].map((p) => getAdherenceDisplay(p).label));
    expect(rotulos.size).toBe(3);
  });
});

describe('formatAdherencePercentage', () => {
  it('redondea a entero — nadie dice "cuatro coma diecisiete por ciento"', () => {
    expect(formatAdherencePercentage(4.17)).toBe('4%');
    expect(formatAdherencePercentage(79.5)).toBe('80%');
    expect(formatAdherencePercentage(100)).toBe('100%');
  });
});
