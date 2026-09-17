import { describe, it, expect } from 'vitest';
import {
  createStockInfo,
  decrementStock,
  updateStockQuantity,
  calculateDaysRemaining,
  calculateStockAlertLevel,
  MeasurementUnit,
  StockAlertLevel,
  type StockInfo,
} from '../../../../src/domain';

function stock(overrides: Partial<StockInfo> = {}): StockInfo {
  return {
    currentQuantity: 10,
    dailyConsumption: 1,
    unit: MeasurementUnit.UNIT,
    criticalThresholdDays: 3,
    ...overrides,
  };
}

describe('createStockInfo', () => {
  it('acepta cantidades no negativas', () => {
    const result = createStockInfo({ currentQuantity: 0, dailyConsumption: 0, unit: MeasurementUnit.UNIT });
    expect(result.ok).toBe(true);
  });

  it('rechaza cantidad negativa', () => {
    const result = createStockInfo({ currentQuantity: -1, dailyConsumption: 1, unit: MeasurementUnit.UNIT });
    expect(result.ok).toBe(false);
  });

  it('default criticalThresholdDays = 3', () => {
    const result = createStockInfo({ currentQuantity: 10, dailyConsumption: 1, unit: MeasurementUnit.UNIT });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.criticalThresholdDays).toBe(3);
  });
});

describe('decrementStock', () => {
  it('decrementa correctamente cuando hay stock suficiente', () => {
    const result = decrementStock(stock({ currentQuantity: 10 }), 3);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.stock.currentQuantity).toBe(7);
      expect(result.value.shortfall).toBe(0);
    }
  });

  /**
   * El stock lo carga el Cuidador a mano y es una ESTIMACIÓN; que la
   * pastilla se haya tomado es un HECHO. Cuando esto devolvía
   * `STOCK_INSUFFICIENT`, un olvido de inventario convertía una toma real
   * en un registro de incumplimiento y falseaba la adherencia, que es lo
   * único que esta app existe para medir.
   */
  it('quedarse sin stock NO invalida la toma: baja hasta cero e informa lo que faltó', () => {
    const result = decrementStock(stock({ currentQuantity: 2 }), 5);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.stock.currentQuantity).toBe(0);
      expect(result.value.shortfall).toBe(3);
    }
  });

  it('NUNCA deja el stock negativo, ni con el inventario en cero', () => {
    const result = decrementStock(stock({ currentQuantity: 0 }), 5);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.stock.currentQuantity).toBe(0);
  });

  it('rechaza cantidad a decrementar <= 0: eso es un llamado mal construido, no un estado del inventario', () => {
    const result = decrementStock(stock(), 0);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('STOCK_INVALID_QUANTITY');
  });

  it('decrementar exactamente hasta 0 no cuenta como faltante', () => {
    const result = decrementStock(stock({ currentQuantity: 5 }), 5);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.stock.currentQuantity).toBe(0);
      expect(result.value.shortfall).toBe(0);
    }
  });
});

describe('updateStockQuantity', () => {
  it('acepta un reemplazo válido (recarga tras compra)', () => {
    const result = updateStockQuantity(stock({ currentQuantity: 1 }), 30);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.currentQuantity).toBe(30);
  });

  it('rechaza cantidad negativa', () => {
    const result = updateStockQuantity(stock(), -1);
    expect(result.ok).toBe(false);
  });
});

describe('calculateDaysRemaining', () => {
  it('calcula currentQuantity / dailyConsumption', () => {
    expect(calculateDaysRemaining(stock({ currentQuantity: 10, dailyConsumption: 2 }))).toBe(5);
  });

  it('retorna Infinity cuando dailyConsumption = 0 (AS_NEEDED, sin riesgo calculable)', () => {
    expect(calculateDaysRemaining(stock({ currentQuantity: 10, dailyConsumption: 0 }))).toBe(
      Number.POSITIVE_INFINITY,
    );
  });
});

describe('calculateStockAlertLevel — umbral CU-03 paso 4 (<=3 días -> CRITICAL)', () => {
  it('CRITICAL cuando días restantes <= criticalThresholdDays', () => {
    const level = calculateStockAlertLevel(stock({ currentQuantity: 3, dailyConsumption: 1, criticalThresholdDays: 3 }));
    expect(level).toBe(StockAlertLevel.CRITICAL);
  });

  it('WARNING cuando días restantes está entre el umbral crítico y 7', () => {
    const level = calculateStockAlertLevel(stock({ currentQuantity: 5, dailyConsumption: 1, criticalThresholdDays: 3 }));
    expect(level).toBe(StockAlertLevel.WARNING);
  });

  it('NORMAL cuando días restantes > 7', () => {
    const level = calculateStockAlertLevel(stock({ currentQuantity: 20, dailyConsumption: 1, criticalThresholdDays: 3 }));
    expect(level).toBe(StockAlertLevel.NORMAL);
  });

  it('con consumo 0 (Infinity días) siempre es NORMAL', () => {
    const level = calculateStockAlertLevel(stock({ currentQuantity: 10, dailyConsumption: 0 }));
    expect(level).toBe(StockAlertLevel.NORMAL);
  });
});
