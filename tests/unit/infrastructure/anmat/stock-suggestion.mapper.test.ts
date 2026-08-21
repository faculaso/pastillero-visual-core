import { describe, it, expect } from 'vitest';
import { suggestInitialStockFromPresentacion } from '../../../../src/infrastructure/persistence/sqlite/anmat/stock-suggestion.mapper';
import { MeasurementUnit } from '../../../../src/domain';

describe('suggestInitialStockFromPresentacion', () => {
  it('extrae la cantidad de "ENVASE CONTENIENDO 30 COMPRIMIDOS"', () => {
    const result = suggestInitialStockFromPresentacion('ENVASE CONTENIENDO 30 COMPRIMIDOS');
    expect(result).toEqual({ quantity: 30, unit: MeasurementUnit.UNIT });
  });

  it('infiere unidad ML cuando el texto la menciona', () => {
    const result = suggestInitialStockFromPresentacion('FRASCO X 100 ML');
    expect(result).toEqual({ quantity: 100, unit: MeasurementUnit.ML });
  });

  it('infiere unidad MG cuando el texto la menciona', () => {
    const result = suggestInitialStockFromPresentacion('AMPOLLA 500 MG');
    expect(result).toEqual({ quantity: 500, unit: MeasurementUnit.MG });
  });

  it('retorna null si no hay ningún número reconocible', () => {
    expect(suggestInitialStockFromPresentacion('FRASCO GOTERO')).toBeNull();
  });

  it('retorna null para input vacío o ausente', () => {
    expect(suggestInitialStockFromPresentacion('')).toBeNull();
    expect(suggestInitialStockFromPresentacion(null)).toBeNull();
    expect(suggestInitialStockFromPresentacion(undefined)).toBeNull();
  });

  it('acepta números decimales con coma', () => {
    const result = suggestInitialStockFromPresentacion('FRASCO X 7,5 ML');
    expect(result).toEqual({ quantity: 7.5, unit: MeasurementUnit.ML });
  });
});
