import { describe, it, expect } from 'vitest';
import { createDosage, createTimeOfDay, MeasurementUnit } from '../../../../src/domain';

describe('createDosage', () => {
  it('acepta una cantidad positiva y finita', () => {
    const result = createDosage(500, MeasurementUnit.MG);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({ amount: 500, unit: MeasurementUnit.MG });
  });

  it.each([0, -5, NaN, Infinity])('rechaza cantidad inválida: %s', (amount) => {
    const result = createDosage(amount, MeasurementUnit.MG);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('STOCK_INVALID_QUANTITY');
  });
});

describe('createTimeOfDay', () => {
  it('acepta horas y minutos válidos', () => {
    const result = createTimeOfDay(23, 59);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({ hour: 23, minute: 59 });
  });

  it.each([
    [-1, 0],
    [24, 0],
    [8, -1],
    [8, 60],
    [8.5, 0],
  ])('rechaza hora=%s minuto=%s fuera de rango', (hour, minute) => {
    const result = createTimeOfDay(hour, minute);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('VALIDATION_ERROR');
  });
});
