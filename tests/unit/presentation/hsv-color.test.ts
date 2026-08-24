import { describe, it, expect } from 'vitest';
import { hsvToHex, hexToHsv } from '../../../src/presentation/utils/hsv-color';

describe('hsvToHex', () => {
  it.each([
    [{ h: 0, s: 1, v: 1 }, '#FF0000'],
    [{ h: 120, s: 1, v: 1 }, '#00FF00'],
    [{ h: 240, s: 1, v: 1 }, '#0000FF'],
    [{ h: 0, s: 0, v: 1 }, '#FFFFFF'],
    [{ h: 0, s: 0, v: 0 }, '#000000'],
  ])('%j -> %s', (hsv, hex) => {
    expect(hsvToHex(hsv)).toBe(hex);
  });
});

describe('hexToHsv', () => {
  it('convierte rojo puro', () => {
    const hsv = hexToHsv('#FF0000');
    expect(hsv.h).toBeCloseTo(0);
    expect(hsv.s).toBeCloseTo(1);
    expect(hsv.v).toBeCloseTo(1);
  });

  it('convierte blanco (sin saturación)', () => {
    const hsv = hexToHsv('#FFFFFF');
    expect(hsv.s).toBeCloseTo(0);
    expect(hsv.v).toBeCloseTo(1);
  });

  it('convierte negro (sin brillo)', () => {
    const hsv = hexToHsv('#000000');
    expect(hsv.v).toBeCloseTo(0);
  });

  it('un hex inválido cae a blanco por default', () => {
    expect(hexToHsv('no-es-un-color')).toEqual({ h: 0, s: 0, v: 1 });
  });

  it('es inversa de hsvToHex para un color arbitrario', () => {
    const original = '#2D9CDB';
    const roundTripped = hsvToHex(hexToHsv(original));
    expect(roundTripped).toBe(original);
  });
});
