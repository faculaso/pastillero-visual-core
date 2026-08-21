import { describe, it, expect, beforeEach } from 'vitest';
import { MonitorAdherenceUseCase } from '../../../src/application';
import { DoseStatus, MeasurementUnit } from '../../../src/domain';
import {
  InMemoryStore,
  InMemoryTreatmentRepository,
  InMemoryDoseRepository,
  InMemoryStockRepository,
} from '../../support/in-memory-repos';
import { FakeClock, FakeNotificationScheduler } from '../../support/fakes';
import { buildTreatment, buildDose } from '../../support/fixtures';

describe('MonitorAdherenceUseCase', () => {
  let store: InMemoryStore;
  let notificationScheduler: FakeNotificationScheduler;
  let useCase: MonitorAdherenceUseCase;
  const now = new Date('2026-08-15T00:00:00.000Z');

  beforeEach(() => {
    store = new InMemoryStore();
    notificationScheduler = new FakeNotificationScheduler();
    const treatmentRepo = new InMemoryTreatmentRepository(store);
    const doseRepo = new InMemoryDoseRepository(store);
    const stockRepo = new InMemoryStockRepository(store);
    useCase = new MonitorAdherenceUseCase(treatmentRepo, doseRepo, stockRepo, notificationScheduler, new FakeClock(now));
  });

  it('calcula % de adherencia y despacha alerta CRITICAL cuando días restantes <= 3', async () => {
    store.treatments.set('treatment-1', buildTreatment({
      stock: { currentQuantity: 2, dailyConsumption: 1, unit: MeasurementUnit.UNIT, criticalThresholdDays: 3 },
    }));
    store.doses.set('d1', buildDose({ id: 'd1', status: DoseStatus.TAKEN, scheduledAt: new Date('2026-08-10') }));
    store.doses.set('d2', buildDose({ id: 'd2', status: DoseStatus.MISSED, scheduledAt: new Date('2026-08-11') }));

    const result = await useCase.execute({ treatmentId: 'treatment-1', requestingCaregiverId: 'caregiver-1' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.metrics.adherencePercentage).toBe(50);
    expect(result.value.metrics.stockAlertLevel).toBe('CRITICAL');
    expect(result.value.criticalAlertDispatched).toBe(true);
    expect(notificationScheduler.dispatchedAlerts).toEqual(['treatment-1']);
  });

  it('NO despacha alerta cuando el stock está en nivel NORMAL', async () => {
    store.treatments.set('treatment-1', buildTreatment({
      stock: { currentQuantity: 30, dailyConsumption: 1, unit: MeasurementUnit.UNIT, criticalThresholdDays: 3 },
    }));

    const result = await useCase.execute({ treatmentId: 'treatment-1', requestingCaregiverId: 'caregiver-1' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.criticalAlertDispatched).toBe(false);
    expect(notificationScheduler.dispatchedAlerts).toEqual([]);
  });

  it('rechaza a un cuidador que no es dueño del tratamiento', async () => {
    store.treatments.set('treatment-1', buildTreatment());
    const result = await useCase.execute({ treatmentId: 'treatment-1', requestingCaregiverId: 'otro-cuidador' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('UNAUTHORIZED_ACTOR');
  });

  it('devuelve las métricas igual si el despacho de la alerta falla (best-effort)', async () => {
    notificationScheduler.shouldFailDispatch = true;
    store.treatments.set('treatment-1', buildTreatment({
      stock: { currentQuantity: 1, dailyConsumption: 1, unit: MeasurementUnit.UNIT, criticalThresholdDays: 3 },
    }));

    const result = await useCase.execute({ treatmentId: 'treatment-1', requestingCaregiverId: 'caregiver-1' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.metrics.stockAlertLevel).toBe('CRITICAL');
    expect(result.value.criticalAlertDispatched).toBe(false); // el despacho falló, pero la consulta no
  });

  it('falla si el tratamiento no existe', async () => {
    const result = await useCase.execute({ treatmentId: 'no-existe', requestingCaregiverId: 'caregiver-1' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('TREATMENT_NOT_FOUND');
  });
});
