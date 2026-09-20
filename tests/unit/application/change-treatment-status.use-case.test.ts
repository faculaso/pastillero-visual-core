import { describe, it, expect, beforeEach } from 'vitest';
import { ChangeTreatmentStatusUseCase } from '../../../src/application';
import { DoseStatus, TreatmentStatus } from '../../../src/domain';
import { InMemoryStore, InMemoryDoseRepository, InMemoryTreatmentRepository } from '../../support/in-memory-repos';
import { FakeClock, FakeNotificationScheduler } from '../../support/fakes';
import { buildTreatment, buildDose } from '../../support/fixtures';

/**
 * El agujero que tapa esto: si el médico suspendía un remedio, el Cuidador
 * no tenía NADA en la app que lo apagara. Seguía sonando para siempre y la
 * única salida era borrarlo, que se lleva puesto el historial.
 */
describe('ChangeTreatmentStatusUseCase', () => {
  const now = new Date(2026, 8, 17, 9, 0, 0);
  let store: InMemoryStore;
  let scheduler: FakeNotificationScheduler;
  let useCase: ChangeTreatmentStatusUseCase;

  /**
   * `recien-sono` es la que importa acá: sonó hace una hora, nadie la tocó,
   * y su notificación sigue en pantalla (se publica `ongoing`, no se
   * descarta deslizándola). `vieja` quedó fuera de la ventana hacia atrás.
   */
  function seedDoses(treatmentId: string): void {
    store.doses.set('vieja', buildDose({ id: 'vieja', treatmentId, scheduledAt: new Date(2026, 8, 10, 8, 0, 0) }));
    store.doses.set('recien-sono', buildDose({ id: 'recien-sono', treatmentId, scheduledAt: new Date(2026, 8, 17, 8, 0, 0) }));
    store.doses.set('futura', buildDose({ id: 'futura', treatmentId, scheduledAt: new Date(2026, 8, 18, 8, 0, 0) }));
    store.doses.set(
      'futura-tomada',
      buildDose({
        id: 'futura-tomada',
        treatmentId,
        scheduledAt: new Date(2026, 8, 19, 8, 0, 0),
        status: DoseStatus.TAKEN,
      }),
    );
  }

  beforeEach(() => {
    store = new InMemoryStore();
    scheduler = new FakeNotificationScheduler();
    useCase = new ChangeTreatmentStatusUseCase(
      new InMemoryTreatmentRepository(store),
      new InMemoryDoseRepository(store),
      scheduler,
      new FakeClock(now),
    );
    store.treatments.set('t1', buildTreatment({ id: 't1', caregiverId: 'caregiver-1' }));
  });

  it('dar de baja deja el tratamiento en CANCELLED', async () => {
    const result = await useCase.execute({
      treatmentId: 't1',
      requestingCaregiverId: 'caregiver-1',
      newStatus: TreatmentStatus.CANCELLED,
    });

    expect(result.ok).toBe(true);
    expect(store.treatments.get('t1')?.status).toBe(TreatmentStatus.CANCELLED);
  });

  it('APAGA las alarmas futuras: sin esto el teléfono sigue sonando por un remedio suspendido', async () => {
    seedDoses('t1');

    const result = await useCase.execute({
      treatmentId: 't1',
      requestingCaregiverId: 'caregiver-1',
      newStatus: TreatmentStatus.CANCELLED,
    });

    expect(result.ok).toBe(true);
    expect(scheduler.cancelledAlarms).toContain('futura');
    if (result.ok) expect(result.value.alarmsAffected).toBe(2);
  });

  it('APAGA también la toma que recién sonó: su notificación sigue en pantalla', async () => {
    // Una toma que ya sonó y nadie confirmó sigue PENDING, y notifee la
    // publica con `ongoing: true` — no se va ni deslizándola. Sin apagarla,
    // dar de baja un remedio recién sonado le dejaba al Adulto Mayor
    // "Es hora de tomar X" clavado, con un botón que confirmaba una toma de
    // un tratamiento que ya no existe.
    seedDoses('t1');

    await useCase.execute({
      treatmentId: 't1',
      requestingCaregiverId: 'caregiver-1',
      newStatus: TreatmentStatus.CANCELLED,
    });

    expect(scheduler.cancelledAlarms).toContain('recien-sono');
  });

  it('no toca la alarma de una toma vieja ni la de una ya confirmada', async () => {
    seedDoses('t1');

    await useCase.execute({
      treatmentId: 't1',
      requestingCaregiverId: 'caregiver-1',
      newStatus: TreatmentStatus.PAUSED,
    });

    expect(scheduler.cancelledAlarms).not.toContain('vieja');
    expect(scheduler.cancelledAlarms).not.toContain('futura-tomada');
  });

  it('reanudar NO reprograma las tomas pasadas: una alarma con hora vieja suena al instante', async () => {
    seedDoses('t1');
    store.treatments.set('t1', buildTreatment({ id: 't1', caregiverId: 'caregiver-1', status: TreatmentStatus.PAUSED }));

    await useCase.execute({
      treatmentId: 't1',
      requestingCaregiverId: 'caregiver-1',
      newStatus: TreatmentStatus.ACTIVE,
    });

    expect(scheduler.scheduledAlarms).not.toContain('recien-sono');
    expect(scheduler.scheduledAlarms).not.toContain('vieja');
  });

  it('reanudar vuelve a programar las alarmas que la pausa había apagado', async () => {
    seedDoses('t1');
    store.treatments.set('t1', buildTreatment({ id: 't1', caregiverId: 'caregiver-1', status: TreatmentStatus.PAUSED }));

    const result = await useCase.execute({
      treatmentId: 't1',
      requestingCaregiverId: 'caregiver-1',
      newStatus: TreatmentStatus.ACTIVE,
    });

    expect(result.ok).toBe(true);
    expect(store.treatments.get('t1')?.status).toBe(TreatmentStatus.ACTIVE);
    expect(scheduler.scheduledAlarms).toEqual(['futura']);
  });

  it('las tomas ya generadas NO se borran: reanudar devuelve la semana intacta', async () => {
    seedDoses('t1');

    await useCase.execute({
      treatmentId: 't1',
      requestingCaregiverId: 'caregiver-1',
      newStatus: TreatmentStatus.PAUSED,
    });

    expect(store.doses.size).toBe(4);
  });

  it('un tratamiento ya dado de baja no se reanuda — lo rechaza el dominio', async () => {
    store.treatments.set(
      't1',
      buildTreatment({ id: 't1', caregiverId: 'caregiver-1', status: TreatmentStatus.CANCELLED }),
    );

    const result = await useCase.execute({
      treatmentId: 't1',
      requestingCaregiverId: 'caregiver-1',
      newStatus: TreatmentStatus.ACTIVE,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('TREATMENT_INVALID_STATUS_TRANSITION');
  });

  it('si la transición es inválida NO se toca ninguna alarma', async () => {
    seedDoses('t1');
    store.treatments.set(
      't1',
      buildTreatment({ id: 't1', caregiverId: 'caregiver-1', status: TreatmentStatus.CANCELLED }),
    );

    await useCase.execute({
      treatmentId: 't1',
      requestingCaregiverId: 'caregiver-1',
      newStatus: TreatmentStatus.ACTIVE,
    });

    expect(scheduler.scheduledAlarms).toHaveLength(0);
    expect(scheduler.cancelledAlarms).toHaveLength(0);
  });

  it('otro cuidador no puede dar de baja un tratamiento ajeno', async () => {
    const result = await useCase.execute({
      treatmentId: 't1',
      requestingCaregiverId: 'otro-cuidador',
      newStatus: TreatmentStatus.CANCELLED,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('UNAUTHORIZED_ACTOR');
    expect(store.treatments.get('t1')?.status).toBe(TreatmentStatus.ACTIVE);
  });

  it('una alarma que no se pudo apagar se reporta, pero la baja NO se revierte', async () => {
    seedDoses('t1');
    scheduler.shouldFailCancelFor = new Set(['futura']);

    const result = await useCase.execute({
      treatmentId: 't1',
      requestingCaregiverId: 'caregiver-1',
      newStatus: TreatmentStatus.CANCELLED,
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.alarmWarnings).toEqual(['futura']);
    expect(store.treatments.get('t1')?.status).toBe(TreatmentStatus.CANCELLED);
  });

  it('un tratamiento inexistente no se confunde con uno ajeno', async () => {
    const result = await useCase.execute({
      treatmentId: 'no-existe',
      requestingCaregiverId: 'caregiver-1',
      newStatus: TreatmentStatus.CANCELLED,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('TREATMENT_NOT_FOUND');
  });
});
