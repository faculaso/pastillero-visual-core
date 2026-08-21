import { describe, it, expect } from 'vitest';
import { calculateAdherenceMetrics, DoseStatus, MeasurementUnit, StockAlertLevel, type Dose, type StockInfo } from '../../../../src/domain';

function dose(status: DoseStatus, id = 'd'): Dose {
  return { id, treatmentId: 't1', scheduledAt: new Date('2026-08-01T08:00:00.000Z'), status };
}

const periodStart = new Date('2026-08-01T00:00:00.000Z');
const periodEnd = new Date('2026-08-31T00:00:00.000Z');

describe('calculateAdherenceMetrics', () => {
  it('100% de adherencia cuando no hubo tomas programadas', () => {
    const stock: StockInfo = { currentQuantity: 10, dailyConsumption: 1, unit: MeasurementUnit.UNIT, criticalThresholdDays: 3 };
    const metrics = calculateAdherenceMetrics('t1', periodStart, periodEnd, [], stock);
    expect(metrics.adherencePercentage).toBe(100);
    expect(metrics.totalScheduled).toBe(0);
  });

  it('calcula el porcentaje correctamente con mezcla de estados', () => {
    const stock: StockInfo = { currentQuantity: 10, dailyConsumption: 1, unit: MeasurementUnit.UNIT, criticalThresholdDays: 3 };
    const doses = [
      dose(DoseStatus.TAKEN, 'd1'),
      dose(DoseStatus.TAKEN, 'd2'),
      dose(DoseStatus.MISSED, 'd3'),
      dose(DoseStatus.PENDING, 'd4'),
    ];
    const metrics = calculateAdherenceMetrics('t1', periodStart, periodEnd, doses, stock);
    expect(metrics.totalScheduled).toBe(4);
    expect(metrics.totalTaken).toBe(2);
    expect(metrics.adherencePercentage).toBe(50);
  });

  it('redondea el porcentaje a 2 decimales', () => {
    const stock: StockInfo = { currentQuantity: 10, dailyConsumption: 1, unit: MeasurementUnit.UNIT, criticalThresholdDays: 3 };
    const doses = [dose(DoseStatus.TAKEN, 'd1'), dose(DoseStatus.PENDING, 'd2'), dose(DoseStatus.PENDING, 'd3')];
    const metrics = calculateAdherenceMetrics('t1', periodStart, periodEnd, doses, stock);
    expect(metrics.adherencePercentage).toBeCloseTo(33.33, 2);
  });

  it('propaga el nivel de alerta y días restantes calculados sobre el stock', () => {
    const stock: StockInfo = { currentQuantity: 2, dailyConsumption: 1, unit: MeasurementUnit.UNIT, criticalThresholdDays: 3 };
    const metrics = calculateAdherenceMetrics('t1', periodStart, periodEnd, [], stock);
    expect(metrics.estimatedDaysRemaining).toBe(2);
    expect(metrics.stockAlertLevel).toBe(StockAlertLevel.CRITICAL);
  });
});
