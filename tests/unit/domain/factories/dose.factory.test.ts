import { describe, it, expect } from 'vitest';
import { confirmDose, markDoseMissed, skipDose, createDoseSlot, DoseStatus, MeasurementUnit } from '../../../../src/domain';
import { buildDose } from '../../../support/fixtures';

const now = new Date('2026-08-01T08:05:00.000Z');

describe('createDoseSlot', () => {
  it('nace en PENDING', () => {
    const result = createDoseSlot({ id: 'd1', treatmentId: 't1', scheduledAt: now });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.status).toBe(DoseStatus.PENDING);
  });

  it('rechaza id/treatmentId vacíos', () => {
    const result = createDoseSlot({ id: '', treatmentId: 't1', scheduledAt: now });
    expect(result.ok).toBe(false);
  });
});

describe('confirmDose', () => {
  it('transiciona PENDING -> TAKEN con timestamp y cantidad', () => {
    const dose = buildDose({ status: DoseStatus.PENDING });
    const result = confirmDose(dose, now, { amount: 1, unit: MeasurementUnit.UNIT });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe(DoseStatus.TAKEN);
      expect(result.value.confirmedAt).toEqual(now);
      expect(result.value.quantityTaken).toEqual({ amount: 1, unit: MeasurementUnit.UNIT });
    }
  });

  it('rechaza reconfirmar una toma ya TAKEN (no es un no-op silencioso)', () => {
    const dose = buildDose({ status: DoseStatus.TAKEN, confirmedAt: now });
    const result = confirmDose(dose, now);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('DOSE_ALREADY_CONFIRMED');
  });

  it('rechaza confirmar una toma MISSED o SKIPPED', () => {
    for (const status of [DoseStatus.MISSED, DoseStatus.SKIPPED]) {
      const dose = buildDose({ status });
      const result = confirmDose(dose, now);
      expect(result.ok).toBe(false);
    }
  });
});

describe('markDoseMissed', () => {
  it('transiciona PENDING -> MISSED', () => {
    const dose = buildDose({ status: DoseStatus.PENDING });
    const result = markDoseMissed(dose);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.status).toBe(DoseStatus.MISSED);
  });

  it('rechaza marcar como missed una toma ya TAKEN', () => {
    const dose = buildDose({ status: DoseStatus.TAKEN });
    const result = markDoseMissed(dose);
    expect(result.ok).toBe(false);
  });
});

describe('skipDose', () => {
  it('transiciona PENDING -> SKIPPED', () => {
    const dose = buildDose({ status: DoseStatus.PENDING });
    const result = skipDose(dose);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.status).toBe(DoseStatus.SKIPPED);
  });
});
