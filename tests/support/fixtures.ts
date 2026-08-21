import {
  TreatmentStatus,
  DoseStatus,
  DosageFrequency,
  MeasurementUnit,
  PillShape,
  type Treatment,
  type Dose,
  type Medication,
} from '../../src/domain';

export function buildMedication(overrides: Partial<Medication> = {}): Medication {
  return {
    id: 'med-1',
    name: 'Paracetamol',
    activeIngredient: 'Paracetamol',
    laboratory: 'Lab X',
    presentation: 'Comprimidos 500mg x30',
    ...overrides,
  };
}

export function buildTreatment(overrides: Partial<Treatment> = {}): Treatment {
  const now = new Date('2026-08-01T00:00:00.000Z');
  return {
    id: 'treatment-1',
    patientId: 'patient-1',
    caregiverId: 'caregiver-1',
    medication: buildMedication(),
    visualProfile: {
      shape: PillShape.ROUND,
      color: '#FFFFFF',
      pillImageUrl: 'https://example.com/pill.png',
    },
    dosageScheme: {
      frequency: DosageFrequency.DAILY,
      timesOfDay: [{ hour: 8, minute: 0 }],
      dosagePerTake: { amount: 1, unit: MeasurementUnit.UNIT },
      startDate: now,
    },
    stock: {
      currentQuantity: 10,
      dailyConsumption: 1,
      unit: MeasurementUnit.UNIT,
      criticalThresholdDays: 3,
    },
    status: TreatmentStatus.ACTIVE,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function buildDose(overrides: Partial<Dose> = {}): Dose {
  return {
    id: 'dose-1',
    treatmentId: 'treatment-1',
    scheduledAt: new Date('2026-08-01T08:00:00.000Z'),
    status: DoseStatus.PENDING,
    ...overrides,
  };
}
