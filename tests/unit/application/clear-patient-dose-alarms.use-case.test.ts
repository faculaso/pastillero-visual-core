import { describe, it, expect, beforeEach } from 'vitest';
import { ClearPatientDoseAlarmsUseCase } from '../../../src/application';
import { DoseStatus } from '../../../src/domain';
import { InMemoryStore, InMemoryDoseRepository } from '../../support/in-memory-repos';
import { FakeClock, FakeNotificationScheduler } from '../../support/fakes';
import { buildTreatment, buildDose } from '../../support/fixtures';

/**
 * El agujero que tapa esto: `SyncDoseAlarmsUseCase` barre las alarmas ajenas,
 * pero corre sólo en el pastillero del Adulto Mayor. Un teléfono que entra
 * únicamente como Cuidador no abre esa pantalla nunca, así que las alarmas
 * que la versión vieja le dejó —con las pastillas de la persona que cuida—
 * le suenan para siempre.
 */
describe('ClearPatientDoseAlarmsUseCase', () => {
  const now = new Date(2026, 8, 28, 9, 0, 0);
  let store: InMemoryStore;
  let scheduler: FakeNotificationScheduler;
  let useCase: ClearPatientDoseAlarmsUseCase;

  beforeEach(() => {
    store = new InMemoryStore();
    scheduler = new FakeNotificationScheduler();
    useCase = new ClearPatientDoseAlarmsUseCase(
      new InMemoryDoseRepository(store),
      scheduler,
      new FakeClock(now),
    );
    // `adriana` es a quien se cuida; `propio` es el dueño del teléfono
    // cuando la misma cuenta tiene los dos roles.
    store.treatments.set('t-adriana', buildTreatment({ id: 't-adriana', patientId: 'adriana', caregiverId: 'c1' }));
    store.treatments.set('t-propio', buildTreatment({ id: 't-propio', patientId: 'propio', caregiverId: 'c1' }));
  });

  function armada(id: string, hoursFromNow: number) {
    return { doseId: id, scheduledAt: new Date(now.getTime() + hoursFromNow * 60 * 60 * 1000) };
  }

  function dose(id: string, treatmentId: string, hoursFromNow: number, overrides: Record<string, unknown> = {}): void {
    store.doses.set(
      id,
      buildDose({
        id,
        treatmentId,
        scheduledAt: new Date(now.getTime() + hoursFromNow * 60 * 60 * 1000),
        ...overrides,
      }),
    );
  }

  it('apaga las alarmas de la persona que se cuida — el teléfono del Cuidador que venía sonando', async () => {
    dose('d1', 't-adriana', 3);
    dose('d2', 't-adriana', 27);
    scheduler.alreadyScheduled = [armada('d1', 3), armada('d2', 27)];

    const result = await useCase.execute({ patientIds: ['adriana'] });

    expect(result.ok).toBe(true);
    expect(scheduler.cancelledAlarms.sort()).toEqual(['d1', 'd2']);
    if (result.ok) expect(result.value.cancelledCount).toBe(2);
  });

  it('NO toca las alarmas propias: una cuenta con los dos roles no se queda sin su medicación', async () => {
    // Este es el motivo de que apunte a ids concretos en vez de cancelar
    // todo. Si barriera el dispositivo entero, entrar como Cuidador le
    // apagaría sus propias alarmas hasta la próxima vez que abriera su
    // pastillero — y nadie se entera hasta que se saltea una toma.
    dose('propia-1', 't-propio', 5);
    dose('ajena-1', 't-adriana', 6);
    scheduler.alreadyScheduled = [armada('propia-1', 5), armada('ajena-1', 6)];

    const result = await useCase.execute({ patientIds: ['adriana'] });

    expect(scheduler.cancelledAlarms).toEqual(['ajena-1']);
    if (result.ok) expect(result.value.cancelledCount).toBe(1);
  });

  it('apaga también la alarma de una toma ya confirmada desde otro teléfono', async () => {
    dose('d1', 't-adriana', 4, { status: DoseStatus.TAKEN });
    scheduler.alreadyScheduled = [armada('d1', 4)];

    await useCase.execute({ patientIds: ['adriana'] });

    expect(scheduler.cancelledAlarms).toEqual(['d1']);
  });

  it('sin alarmas armadas no consulta la base ni una vez — el caso normal del Cuidador', async () => {
    dose('d1', 't-adriana', 3);
    scheduler.alreadyScheduled = [];
    let consultas = 0;
    const repo = new InMemoryDoseRepository(store);
    const original = repo.findByPatientInRange.bind(repo);
    repo.findByPatientInRange = async (...args: Parameters<typeof original>) => {
      consultas += 1;
      return original(...args);
    };
    const conRepoEspiado = new ClearPatientDoseAlarmsUseCase(repo, scheduler, new FakeClock(now));

    const result = await conRepoEspiado.execute({ patientIds: ['adriana'] });

    expect(consultas).toBe(0);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.cancelledCount).toBe(0);
  });

  it('deja intacta la alarma que suena más allá del horizonte', async () => {
    // No se leyó ninguna toma de esa fecha, así que no hay con qué decidir:
    // apagarla por no encontrarla sería borrar lo que sí sirve.
    dose('lejana', 't-adriana', 24 * 45);
    scheduler.alreadyScheduled = [armada('lejana', 24 * 45)];

    const result = await useCase.execute({ patientIds: ['adriana'] });

    expect(scheduler.cancelledAlarms).toEqual([]);
    if (result.ok) expect(result.value.cancelledCount).toBe(0);
  });

  it('barre a los dos pacientes cuando se cuida a más de una persona', async () => {
    store.treatments.set('t-facu', buildTreatment({ id: 't-facu', patientId: 'facu', caregiverId: 'c1' }));
    dose('d-adriana', 't-adriana', 3);
    dose('d-facu', 't-facu', 8);
    scheduler.alreadyScheduled = [armada('d-adriana', 3), armada('d-facu', 8)];

    await useCase.execute({ patientIds: ['adriana', 'facu'] });

    expect(scheduler.cancelledAlarms.sort()).toEqual(['d-adriana', 'd-facu']);
  });

  it('una alarma que no se pudo apagar sale como warning y no frena a las demás', async () => {
    dose('d1', 't-adriana', 3);
    dose('d2', 't-adriana', 4);
    scheduler.alreadyScheduled = [armada('d1', 3), armada('d2', 4)];
    scheduler.shouldFailCancelFor = new Set(['d1']);

    const result = await useCase.execute({ patientIds: ['adriana'] });

    expect(result.ok).toBe(true);
    expect(scheduler.cancelledAlarms).toEqual(['d2']);
    if (result.ok) {
      expect(result.value.cancelledCount).toBe(1);
      expect(result.value.alarmWarnings).toEqual(['d1']);
    }
  });

  it('si el dispositivo no puede listar sus alarmas, devuelve el error en vez de fingir que limpió', async () => {
    scheduler.shouldFailListing = true;

    const result = await useCase.execute({ patientIds: ['adriana'] });

    expect(result.ok).toBe(false);
  });

  it('un Cuidador sin nadie a cargo todavía no hace nada', async () => {
    scheduler.alreadyScheduled = [armada('d1', 3)];

    const result = await useCase.execute({ patientIds: [] });

    expect(scheduler.cancelledAlarms).toEqual([]);
    expect(result.ok).toBe(true);
  });
});
