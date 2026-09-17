import { describe, it, expect, beforeEach } from 'vitest';
import { GetDailyProgressUseCase } from '../../../src/application';
import { DoseStatus, TreatmentStatus } from '../../../src/domain';
import { InMemoryStore, InMemoryDoseRepository, InMemoryTreatmentRepository } from '../../support/in-memory-repos';
import { FakeClock } from '../../support/fakes';
import { buildDose, buildTreatment } from '../../support/fixtures';

describe('GetDailyProgressUseCase', () => {
  let store: InMemoryStore;
  let useCase: GetDailyProgressUseCase;
  const now = new Date('2026-08-01T12:00:00.000Z');

  beforeEach(() => {
    store = new InMemoryStore();
    store.treatments.set('t1', buildTreatment({ id: 't1', patientId: 'patient-1' }));
    useCase = new GetDailyProgressUseCase(
      new InMemoryDoseRepository(store),
      new InMemoryTreatmentRepository(store),
      new FakeClock(now),
    );
  });

  it('cuenta total programado y total tomado del día', async () => {
    store.doses.set('d1', buildDose({ id: 'd1', treatmentId: 't1', status: DoseStatus.TAKEN, scheduledAt: new Date('2026-08-01T08:00:00.000Z') }));
    store.doses.set('d2', buildDose({ id: 'd2', treatmentId: 't1', status: DoseStatus.TAKEN, scheduledAt: new Date('2026-08-01T14:00:00.000Z') }));
    store.doses.set('d3', buildDose({ id: 'd3', treatmentId: 't1', status: DoseStatus.PENDING, scheduledAt: new Date('2026-08-01T20:00:00.000Z') }));

    const result = await useCase.execute({ patientId: 'patient-1' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({ totalScheduled: 3, totalTaken: 2 });
  });

  it('NO cuenta tomas de un tratamiento cancelado — el total tiene que ser alcanzable', async () => {
    // Cancelar un tratamiento no borra sus dosis PENDING ya generadas. Si
    // el denominador las incluye, el paciente ve un total que no puede
    // completar nunca ("1 de 8" con siete tomas realmente listadas) y la
    // pantalla queda en desacuerdo con Mi Semana, que solo mira activos.
    store.treatments.set(
      't2',
      buildTreatment({ id: 't2', patientId: 'patient-1', status: TreatmentStatus.CANCELLED }),
    );
    store.doses.set('d1', buildDose({ id: 'd1', treatmentId: 't1', status: DoseStatus.PENDING, scheduledAt: new Date('2026-08-01T08:00:00.000Z') }));
    store.doses.set('d2', buildDose({ id: 'd2', treatmentId: 't2', status: DoseStatus.PENDING, scheduledAt: new Date('2026-08-01T09:00:00.000Z') }));

    const result = await useCase.execute({ patientId: 'patient-1' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({ totalScheduled: 1, totalTaken: 0 });
  });

  it('tampoco cuenta las de un tratamiento pausado', async () => {
    store.treatments.set(
      't2',
      buildTreatment({ id: 't2', patientId: 'patient-1', status: TreatmentStatus.PAUSED }),
    );
    store.doses.set('d1', buildDose({ id: 'd1', treatmentId: 't2', status: DoseStatus.PENDING, scheduledAt: new Date('2026-08-01T08:00:00.000Z') }));

    const result = await useCase.execute({ patientId: 'patient-1' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({ totalScheduled: 0, totalTaken: 0 });
  });

  it('no cuenta tomas de otros días', async () => {
    store.doses.set('d1', buildDose({ id: 'd1', treatmentId: 't1', status: DoseStatus.TAKEN, scheduledAt: new Date('2026-08-01T08:00:00.000Z') }));
    store.doses.set('d2', buildDose({ id: 'd2', treatmentId: 't1', status: DoseStatus.PENDING, scheduledAt: new Date('2026-08-02T08:00:00.000Z') }));

    const result = await useCase.execute({ patientId: 'patient-1' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({ totalScheduled: 1, totalTaken: 1 });
  });

  it('0 de 0 cuando no hay ninguna toma programada hoy', async () => {
    const result = await useCase.execute({ patientId: 'patient-1' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({ totalScheduled: 0, totalTaken: 0 });
  });

  it('usa la fecha del Clock si no se pasa `date`', async () => {
    store.doses.set('d1', buildDose({ id: 'd1', treatmentId: 't1', status: DoseStatus.TAKEN, scheduledAt: now }));
    const result = await useCase.execute({ patientId: 'patient-1' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.totalScheduled).toBe(1);
  });
});
