import { describe, it, expect, beforeEach } from 'vitest';
import { ConfirmDoseUseCase } from '../../../src/application';
import { TreatmentStatus, DoseStatus, MeasurementUnit } from '../../../src/domain';
import {
  InMemoryStore,
  InMemoryTreatmentRepository,
  InMemoryDoseRepository,
  InMemoryStockRepository,
} from '../../support/in-memory-repos';
import { InMemoryTransactionRunner, FakeClock } from '../../support/fakes';
import { buildTreatment, buildDose } from '../../support/fixtures';

describe('ConfirmDoseUseCase', () => {
  let store: InMemoryStore;
  let useCase: ConfirmDoseUseCase;
  const now = new Date('2026-08-01T08:05:00.000Z');

  beforeEach(() => {
    store = new InMemoryStore();
    const treatmentRepo = new InMemoryTreatmentRepository(store);
    const doseRepo = new InMemoryDoseRepository(store);
    const stockRepo = new InMemoryStockRepository(store);
    const txRunner = new InMemoryTransactionRunner(store);
    useCase = new ConfirmDoseUseCase(doseRepo, treatmentRepo, stockRepo, txRunner, new FakeClock(now));

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

  it('ATOMICIDAD: si falla la persistencia del stock dentro de la transacción, revierte también la confirmación de la toma', async () => {
    // Forzamos el fallo justo después de que confirmDose ya escribió en el store,
    // simulando una falla real de la segunda escritura dentro de la misma transacción.
    const stockRepo = new InMemoryStockRepository(store);
    const originalDecrement = stockRepo.decrement.bind(stockRepo);
    stockRepo.decrement = async () => {
      await originalDecrement('treatment-1', 1); // efecto lateral ya aplicado...
      throw new Error('fallo simulado de escritura'); // ...pero la operación se reporta como fallida
    };

    const treatmentRepo = new InMemoryTreatmentRepository(store);
    const doseRepo = new InMemoryDoseRepository(store);
    const txRunner = new InMemoryTransactionRunner(store);
    const useCaseWithFailingStock = new ConfirmDoseUseCase(
      doseRepo,
      treatmentRepo,
      stockRepo,
      txRunner,
      new FakeClock(now),
    );

    const result = await useCaseWithFailingStock.execute({
      doseId: 'dose-1',
      requestingPatientId: 'patient-1',
    });

    expect(result.ok).toBe(false);
    // La transacción debe haber revertido AMBOS efectos: la toma sigue PENDING
    // y el stock sigue en su valor original, pese a que el decrement interno
    // ya había mutado el store antes de lanzar.
    expect(store.doses.get('dose-1')?.status).toBe(DoseStatus.PENDING);
    expect(store.treatments.get('treatment-1')?.stock.currentQuantity).toBe(10);
  });
});
