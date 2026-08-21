import { describe, it, expect } from 'vitest';
import { createDosageScheme, DosageFrequency, MeasurementUnit } from '../../../../src/domain';

const baseDosage = { amount: 1, unit: MeasurementUnit.UNIT };
const startDate = new Date('2026-08-01T00:00:00.000Z');

describe('createDosageScheme', () => {
  it('crea un esquema DAILY válido', () => {
    const result = createDosageScheme({
      frequency: DosageFrequency.DAILY,
      timesOfDay: [{ hour: 8, minute: 0 }],
      dosagePerTake: baseDosage,
      startDate,
    });
    expect(result.ok).toBe(true);
  });

  it('rechaza endDate anterior o igual a startDate', () => {
    const result = createDosageScheme({
      frequency: DosageFrequency.DAILY,
      timesOfDay: [{ hour: 8, minute: 0 }],
      dosagePerTake: baseDosage,
      startDate,
      endDate: startDate,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('DOSAGE_SCHEME_INVALID');
  });

  it('rechaza timesOfDay vacío salvo AS_NEEDED', () => {
    const result = createDosageScheme({
      frequency: DosageFrequency.DAILY,
      timesOfDay: [],
      dosagePerTake: baseDosage,
      startDate,
    });
    expect(result.ok).toBe(false);
  });

  it('permite timesOfDay vacío para AS_NEEDED', () => {
    const result = createDosageScheme({
      frequency: DosageFrequency.AS_NEEDED,
      timesOfDay: [],
      dosagePerTake: baseDosage,
      startDate,
    });
    expect(result.ok).toBe(true);
  });

  it('CUSTOM_INTERVAL_DAYS requiere intervalDays entero >= 1', () => {
    const missing = createDosageScheme({
      frequency: DosageFrequency.CUSTOM_INTERVAL_DAYS,
      timesOfDay: [{ hour: 8, minute: 0 }],
      dosagePerTake: baseDosage,
      startDate,
    });
    expect(missing.ok).toBe(false);

    const invalid = createDosageScheme({
      frequency: DosageFrequency.CUSTOM_INTERVAL_DAYS,
      timesOfDay: [{ hour: 8, minute: 0 }],
      dosagePerTake: baseDosage,
      startDate,
      intervalDays: 0,
    });
    expect(invalid.ok).toBe(false);

    const valid = createDosageScheme({
      frequency: DosageFrequency.CUSTOM_INTERVAL_DAYS,
      timesOfDay: [{ hour: 8, minute: 0 }],
      dosagePerTake: baseDosage,
      startDate,
      intervalDays: 2,
    });
    expect(valid.ok).toBe(true);
  });

  it('SPECIFIC_WEEKDAYS requiere weekdays únicos en 0-6', () => {
    const empty = createDosageScheme({
      frequency: DosageFrequency.SPECIFIC_WEEKDAYS,
      timesOfDay: [{ hour: 8, minute: 0 }],
      dosagePerTake: baseDosage,
      startDate,
      weekdays: [],
    });
    expect(empty.ok).toBe(false);

    const outOfRange = createDosageScheme({
      frequency: DosageFrequency.SPECIFIC_WEEKDAYS,
      timesOfDay: [{ hour: 8, minute: 0 }],
      dosagePerTake: baseDosage,
      startDate,
      weekdays: [7],
    });
    expect(outOfRange.ok).toBe(false);

    const duplicated = createDosageScheme({
      frequency: DosageFrequency.SPECIFIC_WEEKDAYS,
      timesOfDay: [{ hour: 8, minute: 0 }],
      dosagePerTake: baseDosage,
      startDate,
      weekdays: [1, 1],
    });
    expect(duplicated.ok).toBe(false);

    const valid = createDosageScheme({
      frequency: DosageFrequency.SPECIFIC_WEEKDAYS,
      timesOfDay: [{ hour: 8, minute: 0 }],
      dosagePerTake: baseDosage,
      startDate,
      weekdays: [1, 3, 5],
    });
    expect(valid.ok).toBe(true);
  });
});
