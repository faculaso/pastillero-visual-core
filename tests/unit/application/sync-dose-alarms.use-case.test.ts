import { describe, it, expect, beforeEach } from 'vitest';
import { SyncDoseAlarmsUseCase } from '../../../src/application';
import { DoseStatus, TreatmentStatus } from '../../../src/domain';
import { InMemoryStore, InMemoryDoseRepository, InMemoryTreatmentRepository } from '../../support/in-memory-repos';
import { FakeClock, FakeNotificationScheduler } from '../../support/fakes';
import { buildTreatment, buildDose } from '../../support/fixtures';

/**
 * El agujero que tapa esto: las alarmas de notifee son LOCALES al teléfono
 * que las programa, y el único momento en que se programaban era el alta —
 * una pantalla del Cuidador. Resultado: al Cuidador le sonaban las pastillas
 * de otra persona y al Adulto Mayor no le sonaba nada, nunca.
 */
describe('SyncDoseAlarmsUseCase', () => {
  const now = new Date(2026, 8, 26, 9, 0, 0);
  let store: InMemoryStore;
  let scheduler: FakeNotificationScheduler;
  let useCase: SyncDoseAlarmsUseCase;

  beforeEach(() => {
    store = new InMemoryStore();
    scheduler = new FakeNotificationScheduler();
    useCase = new SyncDoseAlarmsUseCase(
      new InMemoryTreatmentRepository(store),
      new InMemoryDoseRepository(store),
      scheduler,
      new FakeClock(now),
    );
    store.treatments.set('t1', buildTreatment({ id: 't1', patientId: 'p1', caregiverId: 'c1' }));
  });

  function dose(id: string, hoursFromNow: number, overrides: Record<string, unknown> = {}): void {
    store.doses.set(
      id,
      buildDose({
        id,
        treatmentId: 't1',
        scheduledAt: new Date(now.getTime() + hoursFromNow * 60 * 60 * 1000),
        ...overrides,
      }),
    );
  }

  it('arma las alarmas que faltan — el caso del teléfono que quedó sin ninguna', async () => {
    // Pasa de verdad: un arranque en frío del emulador dejó cero alarmas
    // programadas, con tratamientos activos y dosis pendientes.
    dose('d1', 2);
    dose('d2', 26);
    scheduler.alreadyScheduled = [];

    const result = await useCase.execute({ patientId: 'p1' });

    expect(result.ok).toBe(true);
    expect(scheduler.scheduledAlarms.sort()).toEqual(['d1', 'd2']);
    if (result.ok) expect(result.value.scheduledCount).toBe(2);
  });

  it('no reprograma lo que ya está armado: en régimen normal no toca nada', async () => {
    dose('d1', 2);
    dose('d2', 26);
    scheduler.alreadyScheduled = ['d1', 'd2'];

    const result = await useCase.execute({ patientId: 'p1' });

    expect(result.ok).toBe(true);
    expect(scheduler.scheduledAlarms).toEqual([]);
    expect(scheduler.cancelledAlarms).toEqual([]);
    if (result.ok) expect(result.value.scheduledCount).toBe(0);
  });

  it('apaga la alarma de una toma ya confirmada', async () => {
    dose('d1', 2, { status: DoseStatus.TAKEN });
    scheduler.alreadyScheduled = ['d1'];

    const result = await useCase.execute({ patientId: 'p1' });

    expect(result.ok).toBe(true);
    expect(scheduler.cancelledAlarms).toEqual(['d1']);
    if (result.ok) expect(result.value.cancelledCount).toBe(1);
  });

  it('apaga las alarmas de un tratamiento dado de baja desde OTRO teléfono', async () => {
    // El Cuidador lo da de baja en su dispositivo; el del Adulto Mayor se
    // entera recién acá, y hasta entonces seguiría sonando.
    store.treatments.set(
      't1',
      buildTreatment({ id: 't1', patientId: 'p1', caregiverId: 'c1', status: TreatmentStatus.CANCELLED }),
    );
    dose('d1', 2);
    scheduler.alreadyScheduled = ['d1'];

    const result = await useCase.execute({ patientId: 'p1' });

    expect(result.ok).toBe(true);
    expect(scheduler.cancelledAlarms).toEqual(['d1']);
    expect(scheduler.scheduledAlarms).toEqual([]);
  });

  it('no arma alarmas para tomas que ya pasaron: sonarían al instante', async () => {
    dose('pasada', -2);
    dose('futura', 2);

    const result = await useCase.execute({ patientId: 'p1' });

    expect(result.ok).toBe(true);
    expect(scheduler.scheduledAlarms).toEqual(['futura']);
  });

  it('no apaga alarmas de tomas fuera de la ventana consultada', async () => {
    // `d-lejana` no se leyó en esta pasada; no encontrarla NO significa que
    // sobre. Apagarla sería borrar una alarma que sí corresponde.
    dose('d1', 2);
    scheduler.alreadyScheduled = ['d1', 'd-lejana'];

    const result = await useCase.execute({ patientId: 'p1', horizonDays: 1 });

    expect(result.ok).toBe(true);
    expect(scheduler.cancelledAlarms).toEqual([]);
  });

  it('si no se puede leer lo ya programado, falla sin tocar ninguna alarma', async () => {
    dose('d1', 2);
    scheduler.shouldFailListing = true;

    const result = await useCase.execute({ patientId: 'p1' });

    expect(result.ok).toBe(false);
    expect(scheduler.scheduledAlarms).toEqual([]);
    expect(scheduler.cancelledAlarms).toEqual([]);
  });

  it('una alarma que no se pudo armar queda como warning, sin frenar las demás', async () => {
    dose('d1', 2);
    dose('d2', 4);
    scheduler.shouldFailScheduleFor = new Set(['d1']);

    const result = await useCase.execute({ patientId: 'p1' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.alarmWarnings).toEqual(['d1']);
    expect(scheduler.scheduledAlarms).toEqual(['d2']);
    expect(result.value.scheduledCount).toBe(1);
  });
});
