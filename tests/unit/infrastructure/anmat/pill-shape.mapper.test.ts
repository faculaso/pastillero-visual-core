import { describe, it, expect } from 'vitest';
import { mapFormaFarmaceuticaToPillShape } from '../../../../src/infrastructure/persistence/sqlite/anmat/pill-shape.mapper';
import { PillShape } from '../../../../src/domain';

describe('mapFormaFarmaceuticaToPillShape', () => {
  it.each([
    ['COMPRIMIDOS', PillShape.ROUND],
    ['comprimidos recubiertos', PillShape.ROUND],
    ['CÁPSULAS', PillShape.CAPSULE],
    ['Capsula Blanda', PillShape.CAPSULE],
    ['GRAGEAS', PillShape.OVAL],
    ['TABLETAS MASTICABLES', PillShape.ROUND],
  ])('mapea "%s" -> %s', (input, expected) => {
    expect(mapFormaFarmaceuticaToPillShape(input)).toBe(expected);
  });

  it('formas sin pastilla física (inyectables, jarabes) mapean a OTHER, no fallan', () => {
    expect(mapFormaFarmaceuticaToPillShape('SOLUCION INYECTABLE')).toBe(PillShape.OTHER);
    expect(mapFormaFarmaceuticaToPillShape('JARABE')).toBe(PillShape.OTHER);
  });

  it('input vacío o ausente mapea a OTHER', () => {
    expect(mapFormaFarmaceuticaToPillShape('')).toBe(PillShape.OTHER);
    expect(mapFormaFarmaceuticaToPillShape(null)).toBe(PillShape.OTHER);
    expect(mapFormaFarmaceuticaToPillShape(undefined)).toBe(PillShape.OTHER);
  });

  it('es insensible a tildes/diacríticos', () => {
    expect(mapFormaFarmaceuticaToPillShape('CÁPSULA')).toBe(PillShape.CAPSULE);
    expect(mapFormaFarmaceuticaToPillShape('CAPSULA')).toBe(PillShape.CAPSULE);
  });
});
