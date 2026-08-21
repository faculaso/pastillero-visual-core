import { describe, it, expect, beforeEach } from 'vitest';
import { UpdateStockUseCase } from '../../../src/application';
import { MeasurementUnit } from '../../../src/domain';
import { InMemoryStore, InMemoryTreatmentRepository, InMemoryStockRepository } from '../../support/in-memory-repos';
import { FakeNotificationScheduler } from '../../support/fakes';
import { buildTreatment } from '../../support/fixtures';

describe('UpdateStockUseCase', () => {
  let store: InMemoryStore;
  let notificationScheduler: FakeNotificationScheduler;
  let useCase: UpdateStockUseCase;

  beforeEach(() => {
    store = new InMemoryStore();
    notificationScheduler = new FakeNotificationScheduler();
    const treatmentRepo = new InMemoryTreatmentRepository(store);
    const stockRepo = new InMemoryStockRepository(store);
    useCase = new UpdateStockUseCase(treatmentRepo, stockRepo, notificationScheduler);
  });

  it('actualiza el stock y limpia la alerta si el nuevo nivel ya no es CRITICAL', async () => {
    store.treatments.set('treatment-1', buildTreatment({
      stock: { currentQuantity: 1, dailyConsumption: 1, unit: MeasurementUnit.UNIT, criticalThresholdDays: 3 },
    }));

    const result = await useCase.execute({ treatmentId: 'treatment-1', requestingCaregiverId: 'caregiver-1', newQuantity: 30 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.stock.currentQuantity).toBe(30);
    expect(result.value.stockAlertLevel).toBe('NORMAL');
    expect(notificationScheduler.clearedAlerts).toEqual(['treatment-1']);
  });

  it('NO limpia la alerta si el nuevo stock sigue en nivel CRITICAL', async () => {
    store.treatments.set('treatment-1', buildTreatment({
      stock: { currentQuantity: 0, dailyConsumption: 1, unit: MeasurementUnit.UNIT, criticalThresholdDays: 3 },
    }));

    const result = await useCase.execute({ treatmentId: 'treatment-1', requestingCaregiverId: 'caregiver-1', newQuantity: 2 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.stockAlertLevel).toBe('CRITICAL');
    expect(notificationScheduler.clearedAlerts).toEqual([]);
  });

  it('rechaza cantidad negativa (invariante de dominio)', async () => {
    store.treatments.set('treatment-1', buildTreatment());
    const result = await useCase.execute({ treatmentId: 'treatment-1', requestingCaregiverId: 'caregiver-1', newQuantity: -5 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('STOCK_INVALID_QUANTITY');
  });

  it('rechaza a un cuidador no autorizado', async () => {
    store.treatments.set('treatment-1', buildTreatment());
    const result = await useCase.execute({ treatmentId: 'treatment-1', requestingCaregiverId: 'otro', newQuantity: 10 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('UNAUTHORIZED_ACTOR');
  });
});
