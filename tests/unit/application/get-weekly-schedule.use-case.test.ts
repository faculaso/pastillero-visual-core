import { describe, it, expect, beforeEach } from 'vitest';
import { GetWeeklyScheduleUseCase } from '../../../src/application';
import { DoseStatus, StockAlertLevel, TreatmentStatus, MeasurementUnit } from '../../../src/domain';
import { InMemoryStore, InMemoryTreatmentRepository, InMemoryDoseRepository } from '../../support/in-memory-repos';
import { FakeClock } from '../../support/fakes';
import { buildTreatment, buildDose, buildMedication } from '../../support/fixtures';

describe('GetWeeklyScheduleUseCase', () => {
  let store: InMemoryStore;
  let useCase: GetWeeklyScheduleUseCase;
  // Miércoles a media mañana — cualquier día intermedio de la semana sirve para probar los bounds.
  const now = new Date('2026-08-05T10:00:00.000Z');

  beforeEach(() => {
    store = new InMemoryStore();
    const doseRepository = new InMemoryDoseRepository(store);
    const treatmentRepository = new InMemoryTreatmentRepository(store);
    useCase = new GetWeeklyScheduleUseCase(doseRepository, treatmentRepository, new FakeClock(now));
  });

  it('calcula la semana domingo 00:00 -> sábado 23:59:59.999 en la que cae "ahora"', async () => {
    const result = await useCase.execute({ patientId: 'patient-1' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const { weekStart, weekEnd } = result.value;
    expect(weekStart.getDay()).toBe(0);
    expect([weekStart.getHours(), weekStart.getMinutes(), weekStart.getSeconds()]).toEqual([0, 0, 0]);
    expect(weekEnd.getDay()).toBe(6);
    expect([weekEnd.getHours(), weekEnd.getMinutes(), weekEnd.getSeconds()]).toEqual([23, 59, 59]);
    expect(now.getTime()).toBeGreaterThanOrEqual(weekStart.getTime());
    expect(now.getTime()).toBeLessThanOrEqual(weekEnd.getTime());
  });

  it('resuelve nombre y perfil visual del tratamiento para cada dosis (sin N+1: una sola pasada de findActiveByPatient)', async () => {
    const medication = buildMedication({ id: 'med-1', name: 'Losartán' });
    const treatment = buildTreatment({ id: 't1', patientId: 'patient-1', medication });
    store.treatments.set('t1', treatment);
    store.doses.set('d1', buildDose({ id: 'd1', treatmentId: 't1', scheduledAt: new Date(now) }));
    store.doses.set('d2', buildDose({ id: 'd2', treatmentId: 't1', scheduledAt: new Date(now) }));

    const result = await useCase.execute({ patientId: 'patient-1' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.doses).toHaveLength(2);
    expect(result.value.doses.every((d) => d.medicationName === 'Losartán')).toBe(true);
    expect(result.value.doses.every((d) => d.visualProfile === treatment.visualProfile)).toBe(true);
  });

  it('excluye dosis de tratamientos que ya no están activos (pausados/cancelados)', async () => {
    const treatment = buildTreatment({ id: 't1', patientId: 'patient-1', status: TreatmentStatus.PAUSED });
    store.treatments.set('t1', treatment);
    store.doses.set('d1', buildDose({ id: 'd1', treatmentId: 't1', scheduledAt: new Date(now) }));

    const result = await useCase.execute({ patientId: 'patient-1' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.doses).toHaveLength(0);
  });

  it('solo lista tratamientos con stock WARNING o CRITICAL en treatmentsNeedingAttention', async () => {
    const okTreatment = buildTreatment({
      id: 't-ok',
      patientId: 'patient-1',
      medication: buildMedication({ id: 'm-ok', name: 'Con stock normal' }),
      stock: { currentQuantity: 100, dailyConsumption: 1, unit: MeasurementUnit.UNIT, criticalThresholdDays: 3 },
    });
    const criticalTreatment = buildTreatment({
      id: 't-critical',
      patientId: 'patient-1',
      medication: buildMedication({ id: 'm-critical', name: 'Por agotarse' }),
      stock: { currentQuantity: 1, dailyConsumption: 1, unit: MeasurementUnit.UNIT, criticalThresholdDays: 3 },
    });
    store.treatments.set('t-ok', okTreatment);
    store.treatments.set('t-critical', criticalTreatment);

    const result = await useCase.execute({ patientId: 'patient-1' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.treatmentsNeedingAttention).toHaveLength(1);
    expect(result.value.treatmentsNeedingAttention[0]?.treatmentId).toBe('t-critical');
    expect(result.value.treatmentsNeedingAttention[0]?.stockAlertLevel).toBe(StockAlertLevel.CRITICAL);
  });

  it('calcula adherencePercentage solo sobre dosis con scheduledAt ya pasado', async () => {
    const treatment = buildTreatment({ id: 't1', patientId: 'patient-1' });
    store.treatments.set('t1', treatment);
    const past = new Date(now.getTime() - 60 * 60 * 1000);
    const future = new Date(now.getTime() + 60 * 60 * 1000);
    store.doses.set('d-past-taken', buildDose({ id: 'd-past-taken', treatmentId: 't1', scheduledAt: past, status: DoseStatus.TAKEN }));
    store.doses.set('d-past-missed', buildDose({ id: 'd-past-missed', treatmentId: 't1', scheduledAt: past, status: DoseStatus.MISSED }));
    store.doses.set('d-future', buildDose({ id: 'd-future', treatmentId: 't1', scheduledAt: future, status: DoseStatus.PENDING }));

    const result = await useCase.execute({ patientId: 'patient-1' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // 1 de 2 dosis pasadas tomada -> 50%, la futura no cuenta.
    expect(result.value.adherencePercentage).toBe(50);
  });

  it('devuelve 100% de adherencia si ninguna dosis de la semana ya pasó', async () => {
    const treatment = buildTreatment({ id: 't1', patientId: 'patient-1' });
    store.treatments.set('t1', treatment);
    const future = new Date(now.getTime() + 60 * 60 * 1000);
    store.doses.set('d-future', buildDose({ id: 'd-future', treatmentId: 't1', scheduledAt: future }));

    const result = await useCase.execute({ patientId: 'patient-1' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.adherencePercentage).toBe(100);
  });
});
