import { describe, it, expect, beforeEach } from 'vitest';
import { GetPendingDosesForPatientUseCase } from '../../../src/application';
import { DoseStatus, PillShape, MeasurementUnit, TreatmentStatus } from '../../../src/domain';
import { InMemoryStore, InMemoryTreatmentRepository, InMemoryDoseRepository } from '../../support/in-memory-repos';
import { FakeClock } from '../../support/fakes';
import { buildTreatment, buildDose } from '../../support/fixtures';

describe('GetPendingDosesForPatientUseCase', () => {
  let store: InMemoryStore;
  let useCase: GetPendingDosesForPatientUseCase;
  const now = new Date('2026-08-01T07:00:00.000Z');

  beforeEach(() => {
    store = new InMemoryStore();
    const treatmentRepo = new InMemoryTreatmentRepository(store);
    const doseRepo = new InMemoryDoseRepository(store);
    useCase = new GetPendingDosesForPatientUseCase(doseRepo, treatmentRepo, new FakeClock(now));
  });

  it('NO muestra la toma de un tratamiento cancelado', async () => {
    // El caso más grave posible acá: el Cuidador dio de baja el
    // tratamiento y la app le seguía diciendo al paciente que lo tomara.
    // Cancelar pasa el treatment a CANCELLED pero deja intactas las dosis
    // PENDING que ya se habían generado, así que el filtro tiene que estar
    // en la lectura.
    store.treatments.set(
      't-baja',
      buildTreatment({ id: 't-baja', patientId: 'patient-1', status: TreatmentStatus.CANCELLED }),
    );
    store.doses.set(
      'd-baja',
      buildDose({ id: 'd-baja', treatmentId: 't-baja', status: DoseStatus.PENDING, scheduledAt: new Date('2026-08-01T08:00:00.000Z') }),
    );

    const result = await useCase.execute({ patientId: 'patient-1' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.doses).toEqual([]);
  });

  it('tampoco muestra la de un tratamiento pausado, pero sí la de uno activo del mismo paciente', async () => {
    store.treatments.set('t-activo', buildTreatment({ id: 't-activo', patientId: 'patient-1' }));
    store.treatments.set(
      't-pausa',
      buildTreatment({ id: 't-pausa', patientId: 'patient-1', status: TreatmentStatus.PAUSED }),
    );
    store.doses.set(
      'd-activa',
      buildDose({ id: 'd-activa', treatmentId: 't-activo', status: DoseStatus.PENDING, scheduledAt: new Date('2026-08-01T08:00:00.000Z') }),
    );
    store.doses.set(
      'd-pausada',
      buildDose({ id: 'd-pausada', treatmentId: 't-pausa', status: DoseStatus.PENDING, scheduledAt: new Date('2026-08-01T09:00:00.000Z') }),
    );

    const result = await useCase.execute({ patientId: 'patient-1' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.doses.map((d) => d.doseId)).toEqual(['d-activa']);
  });

  it('enriquece cada dose pendiente con nombre del medicamento y perfil visual del treatment', async () => {
    store.treatments.set('t1', buildTreatment({ id: 't1', patientId: 'p1' }));
    store.doses.set('d1', buildDose({ id: 'd1', treatmentId: 't1', status: DoseStatus.PENDING, scheduledAt: now }));

    const result = await useCase.execute({ patientId: 'p1', date: now });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.doses).toHaveLength(1);
    expect(result.value.doses[0]).toMatchObject({
      doseId: 'd1',
      medicationName: 'Paracetamol',
      visualProfile: { shape: PillShape.ROUND, color: '#FFFFFF' },
      dosagePerTake: { amount: 1, unit: MeasurementUnit.UNIT },
    });
  });

  it('ordena por scheduledAt ascendente (la más próxima primero)', async () => {
    store.treatments.set('t1', buildTreatment({ id: 't1', patientId: 'p1' }));
    store.doses.set('d-late', buildDose({ id: 'd-late', treatmentId: 't1', scheduledAt: new Date('2026-08-01T20:00:00.000Z') }));
    store.doses.set('d-early', buildDose({ id: 'd-early', treatmentId: 't1', scheduledAt: new Date('2026-08-01T08:00:00.000Z') }));

    const result = await useCase.execute({ patientId: 'p1', date: now });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.doses.map((d) => d.doseId)).toEqual(['d-early', 'd-late']);
  });

  it('no incluye doses ya TAKEN', async () => {
    store.treatments.set('t1', buildTreatment({ id: 't1', patientId: 'p1' }));
    store.doses.set('d1', buildDose({ id: 'd1', treatmentId: 't1', status: DoseStatus.TAKEN }));

    const result = await useCase.execute({ patientId: 'p1', date: now });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.doses).toHaveLength(0);
  });

  it('usa la fecha actual del Clock si no se pasa `date`', async () => {
    store.treatments.set('t1', buildTreatment({ id: 't1', patientId: 'p1' }));
    store.doses.set('d1', buildDose({ id: 'd1', treatmentId: 't1', scheduledAt: now }));

    const result = await useCase.execute({ patientId: 'p1' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.doses).toHaveLength(1);
  });
});
