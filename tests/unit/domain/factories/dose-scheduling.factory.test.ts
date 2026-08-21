import { describe, it, expect } from 'vitest';
import { calculateScheduledDoseTimes, DosageFrequency, MeasurementUnit, type DosageScheme } from '../../../../src/domain';

const baseDosage = { amount: 1, unit: MeasurementUnit.UNIT };

describe('calculateScheduledDoseTimes', () => {
  it('AS_NEEDED nunca genera slots', () => {
    const scheme: DosageScheme = {
      frequency: DosageFrequency.AS_NEEDED,
      timesOfDay: [],
      dosagePerTake: baseDosage,
      startDate: new Date('2026-08-01'),
    };
    const result = calculateScheduledDoseTimes(scheme, new Date('2026-08-01'), new Date('2026-08-10'));
    expect(result).toEqual([]);
  });

  it('DAILY con 2 horarios genera 2 slots por día en el rango', () => {
    const scheme: DosageScheme = {
      frequency: DosageFrequency.DAILY,
      timesOfDay: [{ hour: 8, minute: 0 }, { hour: 20, minute: 0 }],
      dosagePerTake: baseDosage,
      startDate: new Date('2026-08-01T00:00:00.000Z'),
    };
    const result = calculateScheduledDoseTimes(
      scheme,
      new Date('2026-08-01T00:00:00.000Z'),
      new Date('2026-08-03T00:00:00.000Z'), // 3 días inclusive
    );
    expect(result).toHaveLength(6); // 3 días x 2 horarios
  });

  it('respeta scheme.endDate aunque el rango pedido sea más amplio', () => {
    const scheme: DosageScheme = {
      frequency: DosageFrequency.DAILY,
      timesOfDay: [{ hour: 8, minute: 0 }],
      dosagePerTake: baseDosage,
      startDate: new Date('2026-08-01T00:00:00.000Z'),
      endDate: new Date('2026-08-02T00:00:00.000Z'),
    };
    const result = calculateScheduledDoseTimes(
      scheme,
      new Date('2026-08-01T00:00:00.000Z'),
      new Date('2026-08-30T00:00:00.000Z'),
    );
    expect(result).toHaveLength(2); // día 1 y día 2 solamente
  });

  it('SPECIFIC_WEEKDAYS solo genera slots en los días indicados', () => {
    // 2026-08-03 es lunes (weekday 1); pedimos lunes y miércoles (1,3)
    const scheme: DosageScheme = {
      frequency: DosageFrequency.SPECIFIC_WEEKDAYS,
      timesOfDay: [{ hour: 9, minute: 0 }],
      dosagePerTake: baseDosage,
      startDate: new Date('2026-08-03T00:00:00.000Z'),
      weekdays: [1, 3],
    };
    const result = calculateScheduledDoseTimes(
      scheme,
      new Date('2026-08-03T00:00:00.000Z'),
      new Date('2026-08-09T00:00:00.000Z'), // semana completa
    );
    // lunes 3 y miércoles 5 -> 2 slots
    expect(result).toHaveLength(2);
  });

  it('CUSTOM_INTERVAL_DAYS respeta el intervalo desde el inicio del rango', () => {
    const scheme: DosageScheme = {
      frequency: DosageFrequency.CUSTOM_INTERVAL_DAYS,
      timesOfDay: [{ hour: 10, minute: 0 }],
      dosagePerTake: baseDosage,
      startDate: new Date('2026-08-01T00:00:00.000Z'),
      intervalDays: 3,
    };
    const result = calculateScheduledDoseTimes(
      scheme,
      new Date('2026-08-01T00:00:00.000Z'),
      new Date('2026-08-09T00:00:00.000Z'), // 9 días -> día 1,4,7 (3 slots)
    );
    expect(result).toHaveLength(3);
  });

  it('retorna [] si el rango pedido termina antes del startDate del scheme', () => {
    const scheme: DosageScheme = {
      frequency: DosageFrequency.DAILY,
      timesOfDay: [{ hour: 8, minute: 0 }],
      dosagePerTake: baseDosage,
      startDate: new Date('2026-09-01T00:00:00.000Z'),
    };
    const result = calculateScheduledDoseTimes(
      scheme,
      new Date('2026-08-01T00:00:00.000Z'),
      new Date('2026-08-10T00:00:00.000Z'),
    );
    expect(result).toEqual([]);
  });
});
