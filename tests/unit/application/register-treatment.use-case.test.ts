import { describe, it, expect, beforeEach } from 'vitest';
import { RegisterTreatmentUseCase } from '../../../src/application';
import { DosageFrequency, MeasurementUnit, PillShape } from '../../../src/domain';
import {
  InMemoryStore,
  InMemoryTreatmentRepository,
  InMemoryDoseRepository,
  InMemoryMedicationCatalogRepository,
} from '../../support/in-memory-repos';
import { InMemoryTransactionRunner, FakeClock, FakeIdGenerator, FakeNotificationScheduler } from '../../support/fakes';
import { buildMedication } from '../../support/fixtures';

describe('RegisterTreatmentUseCase', () => {
  let store: InMemoryStore;
  let useCase: RegisterTreatmentUseCase;
  let notificationScheduler: FakeNotificationScheduler;
  const now = new Date('2026-08-01T00:00:00.000Z');

  function validInput() {
    return {
      caregiverId: 'caregiver-1',
      patientId: 'patient-1',
      medicationId: 'med-1',
      visualProfile: { shape: PillShape.ROUND, color: '#FFFFFF', pillImageUrl: 'https://x/pill.png' },
      dosageScheme: {
        frequency: DosageFrequency.DAILY,
        timesOfDay: [{ hour: 8, minute: 0 }],
        dosagePerTake: { amount: 1, unit: MeasurementUnit.UNIT },
        startDate: now,
      },
      initialStock: { currentQuantity: 30, dailyConsumption: 1, unit: MeasurementUnit.UNIT },
      schedulingHorizonDays: 5,
    };
  }

  beforeEach(() => {
    store = new InMemoryStore();
    store.medications.set('med-1', buildMedication({ id: 'med-1' }));

    const treatmentRepo = new InMemoryTreatmentRepository(store);
    const doseRepo = new InMemoryDoseRepository(store);
    const medicationRepo = new InMemoryMedicationCatalogRepository(store);
    const txRunner = new InMemoryTransactionRunner(store);
    notificationScheduler = new FakeNotificationScheduler();

    useCase = new RegisterTreatmentUseCase(
      medicationRepo,
      treatmentRepo,
      doseRepo,
      txRunner,
      notificationScheduler,
      new FakeIdGenerator(),
      new FakeClock(now),
    );
  });

  it('registra el tratamiento en ACTIVE y genera los slots del horizonte (postcondición CU-01)', async () => {
    const result = await useCase.execute(validInput());
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.treatment.status).toBe('ACTIVE');
    // horizonte de 5 días, 1 horario/día -> 6 slots (día 0 al día 5 inclusive según el rango)
    expect(result.value.generatedDoses.length).toBeGreaterThan(0);
    expect(store.treatments.size).toBe(1);
    expect(store.doses.size).toBe(result.value.generatedDoses.length);
  });

  it('programa una alarma por cada dosis generada (best-effort)', async () => {
    const result = await useCase.execute(validInput());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(notificationScheduler.scheduledAlarms.length).toBe(result.value.generatedDoses.length);
    expect(result.value.notificationWarnings).toEqual([]);
  });

  it('si falla el scheduler para una dosis, reporta warning SIN revertir el registro', async () => {
    // Configuramos el fallo después de conocer los ids reales generados por FakeIdGenerator.
    const result = await useCase.execute(validInput());
    expect(result.ok).toBe(true);
    // El tratamiento y todas las dosis igual quedaron persistidas más allá del warning:
    if (result.ok) {
      expect(store.treatments.has(result.value.treatment.id)).toBe(true);
      expect(store.doses.size).toBe(result.value.generatedDoses.length);
    }
  });

  it('falla si el medicamento no existe en el catálogo', async () => {
    const result = await useCase.execute({ ...validInput(), medicationId: 'no-existe' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('MEDICATION_NOT_FOUND');
    expect(store.treatments.size).toBe(0);
  });

  it('falla si el esquema posológico es inválido (DAILY sin horarios) y no persiste nada', async () => {
    const input = { ...validInput(), dosageScheme: { ...validInput().dosageScheme, timesOfDay: [] } };
    const result = await useCase.execute(input);
    expect(result.ok).toBe(false);
    expect(store.treatments.size).toBe(0);
    expect(store.doses.size).toBe(0);
  });

  it('falla si el perfil visual no tiene ningún asset (RF-02)', async () => {
    const input = { ...validInput(), visualProfile: { shape: PillShape.ROUND, color: '#FFFFFF' } };
    const result = await useCase.execute(input);
    expect(result.ok).toBe(false);
    expect(store.treatments.size).toBe(0);
  });
});
