import { describe, it, expect, beforeEach } from 'vitest';
import { ConfirmDoseUseCase } from '../../../src/application';
import { TreatmentStatus, DoseStatus, MeasurementUnit } from '../../../src/domain';
import { InMemoryStore, InMemoryTreatmentRepository, InMemoryDoseRepository } from '../../support/in-memory-repos';
import { FakeClock } from '../../support/fakes';
import { buildTreatment, buildDose } from '../../support/fixtures';

describe('ConfirmDoseUseCase', () => {
  let store: InMemoryStore;
  let useCase: ConfirmDoseUseCase;
  const now = new Date('2026-08-01T08:05:00.000Z');

  beforeEach(() => {
    store = new InMemoryStore();
    const treatmentRepo = new InMemoryTreatmentRepository(store);
    const doseRepo = new InMemoryDoseRepository(store);
    useCase = new ConfirmDoseUseCase(doseRepo, treatmentRepo, new FakeClock(now));

    store.treatments.set('treatment-1', buildTreatment({ stock: { currentQuantity: 10, dailyConsumption: 1, unit: MeasurementUnit.UNIT, criticalThresholdDays: 3 } }));
    store.doses.set('dose-1', buildDose({ status: DoseStatus.PENDING }));
  });

  it('confirma la toma y decrementa el stock atómicamente', async () => {
    const result = await useCase.execute({ doseId: 'dose-1', requestingPatientId: 'patient-1' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.dose.status).toBe(DoseStatus.TAKEN);
    expect(result.value.stock.currentQuantity).toBe(9); // 10 - dosagePerTake.amount (1)
    expect(store.doses.get('dose-1')?.status).toBe(DoseStatus.TAKEN);
    expect(store.treatments.get('treatment-1')?.stock.currentQuantity).toBe(9);
  });

  it('rechaza confirmar dos veces la misma toma', async () => {
    await useCase.execute({ doseId: 'dose-1', requestingPatientId: 'patient-1' });
    const second = await useCase.execute({ doseId: 'dose-1', requestingPatientId: 'patient-1' });

    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.error.code).toBe('DOSE_ALREADY_CONFIRMED');
    // el stock NO debe decrementarse una segunda vez
    expect(store.treatments.get('treatment-1')?.stock.currentQuantity).toBe(9);
  });

  it('rechaza al paciente equivocado (autorización)', async () => {
    const result = await useCase.execute({ doseId: 'dose-1', requestingPatientId: 'otro-paciente' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('UNAUTHORIZED_ACTOR');
  });

  it('rechaza confirmar una toma de un tratamiento no ACTIVE', async () => {
    store.treatments.set('treatment-1', { ...store.treatments.get('treatment-1')!, status: TreatmentStatus.PAUSED });
    const result = await useCase.execute({ doseId: 'dose-1', requestingPatientId: 'patient-1' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('TREATMENT_NOT_ACTIVE');
  });

  it('rechaza confirmar si el stock es insuficiente y NO toca la toma', async () => {
    store.treatments.set('treatment-1', {
      ...store.treatments.get('treatment-1')!,
      stock: { currentQuantity: 0, dailyConsumption: 1, unit: MeasurementUnit.UNIT, criticalThresholdDays: 3 },
    });
    const result = await useCase.execute({ doseId: 'dose-1', requestingPatientId: 'patient-1' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('STOCK_INSUFFICIENT');
    // fail-fast: la validación de dominio corta ANTES de abrir transacción
    expect(store.doses.get('dose-1')?.status).toBe(DoseStatus.PENDING);
  });

  // La atomicidad "confirmar + decrementar stock" ya no es una orquestación
  // que este use case coordine (antes: dos repos + `TransactionRunner`) —
  // ahora es UN SOLO método atómico del repositorio
  // (`DoseRepository.confirmDoseWithStockDecrement`), así que se prueba
  // contra SQLite real en
  // `tests/integration/confirm-dose.atomicity.integration.test.ts`, no acá.
});
