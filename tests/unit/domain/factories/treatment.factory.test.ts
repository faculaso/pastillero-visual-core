import { describe, it, expect } from 'vitest';
import {
  createTreatment,
  transitionTreatmentStatus,
  TreatmentStatus,
  PillShape,
  DosageFrequency,
  MeasurementUnit,
} from '../../../../src/domain';
import { buildMedication, buildTreatment } from '../../../support/fixtures';

const now = new Date('2026-08-01T00:00:00.000Z');

function validInput() {
  return {
    id: 'treatment-1',
    patientId: 'patient-1',
    caregiverId: 'caregiver-1',
    medication: buildMedication(),
    visualProfile: { shape: PillShape.ROUND, color: '#FFFFFF', pillImageUrl: 'https://x/pill.png' },
    dosageScheme: {
      frequency: DosageFrequency.DAILY,
      timesOfDay: [{ hour: 8, minute: 0 }],
      dosagePerTake: { amount: 1, unit: MeasurementUnit.UNIT },
      startDate: now,
    },
    stock: { currentQuantity: 10, dailyConsumption: 1, unit: MeasurementUnit.UNIT, criticalThresholdDays: 3 },
    now,
  };
}

describe('createTreatment', () => {
  it('crea el tratamiento en estado ACTIVE (postcondición CU-01)', () => {
    const result = createTreatment(validInput());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe(TreatmentStatus.ACTIVE);
      expect(result.value.createdAt).toEqual(now);
      expect(result.value.updatedAt).toEqual(now);
    }
  });

  it.each(['id', 'patientId', 'caregiverId'] as const)('rechaza %s vacío', (field) => {
    const input = { ...validInput(), [field]: '   ' };
    const result = createTreatment(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('transitionTreatmentStatus', () => {
  it('permite ACTIVE -> PAUSED', () => {
    const treatment = buildTreatment({ status: TreatmentStatus.ACTIVE });
    const result = transitionTreatmentStatus(treatment, TreatmentStatus.PAUSED, now);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe(TreatmentStatus.PAUSED);
      expect(result.value.updatedAt).toEqual(now);
    }
  });

  it('rechaza COMPLETED -> ACTIVE (estado terminal)', () => {
    const treatment = buildTreatment({ status: TreatmentStatus.COMPLETED });
    const result = transitionTreatmentStatus(treatment, TreatmentStatus.ACTIVE, now);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('TREATMENT_INVALID_STATUS_TRANSITION');
  });

  it('rechaza CANCELLED -> cualquier otro estado', () => {
    const treatment = buildTreatment({ status: TreatmentStatus.CANCELLED });
    const result = transitionTreatmentStatus(treatment, TreatmentStatus.ACTIVE, now);
    expect(result.ok).toBe(false);
  });

  it('permite PAUSED -> ACTIVE (reanudar)', () => {
    const treatment = buildTreatment({ status: TreatmentStatus.PAUSED });
    const result = transitionTreatmentStatus(treatment, TreatmentStatus.ACTIVE, now);
    expect(result.ok).toBe(true);
  });
});
