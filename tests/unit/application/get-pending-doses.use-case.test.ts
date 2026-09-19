import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GetPendingDosesForPatientUseCase } from '../../../src/application';
import { Err, DomainErrors, DoseStatus, PillShape, MeasurementUnit, TreatmentStatus } from '../../../src/domain';
import {
  InMemoryStore,
  InMemoryTreatmentRepository,
  InMemoryDoseRepository,
  InMemoryProfileRepository,
} from '../../support/in-memory-repos';
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
    useCase = new GetPendingDosesForPatientUseCase(
      doseRepo,
      treatmentRepo,
      new FakeClock(now),
      new InMemoryProfileRepository(store),
    );
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

  describe('quién cargó el tratamiento', () => {
    function perfil(id: string, nombre: string | null) {
      return { id, role: 'CUIDADOR' as const, displayName: nombre, inviteCode: null, isPatient: false, isCaregiver: true };
    }

    function tomaPendiente(idTratamiento: string, idDosis: string, idCuidador: string, hora: string) {
      store.treatments.set(
        idTratamiento,
        buildTreatment({ id: idTratamiento, patientId: 'patient-1', caregiverId: idCuidador }),
      );
      store.doses.set(
        idDosis,
        buildDose({ id: idDosis, treatmentId: idTratamiento, scheduledAt: new Date(hora), status: DoseStatus.PENDING }),
      );
    }

    it('devuelve el nombre de quien lo indicó', async () => {
      store.profiles.set('caregiver-1', perfil('caregiver-1', 'Ana'));
      tomaPendiente('t-1', 'd-1', 'caregiver-1', '2026-08-01T08:00:00.000Z');

      const result = await useCase.execute({ patientId: 'patient-1', date: now });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.doses[0]?.caregiverName).toBe('Ana');
    });

    it('consulta el perfil UNA sola vez aunque el cuidador haya cargado varias tomas', async () => {
      // Un pastillero típico viene de una sola persona: sin memoizar serían
      // cuatro consultas idénticas por cada apertura de la pantalla.
      store.profiles.set('caregiver-1', perfil('caregiver-1', 'Ana'));
      tomaPendiente('t-1', 'd-1', 'caregiver-1', '2026-08-01T08:00:00.000Z');
      tomaPendiente('t-2', 'd-2', 'caregiver-1', '2026-08-01T14:00:00.000Z');
      tomaPendiente('t-3', 'd-3', 'caregiver-1', '2026-08-01T21:00:00.000Z');

      const profileRepo = new InMemoryProfileRepository(store);
      const espia = vi.spyOn(profileRepo, 'findById');
      const conEspia = new GetPendingDosesForPatientUseCase(
        new InMemoryDoseRepository(store),
        new InMemoryTreatmentRepository(store),
        new FakeClock(now),
        profileRepo,
      );

      const result = await conEspia.execute({ patientId: 'patient-1', date: now });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.doses).toHaveLength(3);
      expect(result.value.doses.every((d) => d.caregiverName === 'Ana')).toBe(true);
      expect(espia).toHaveBeenCalledTimes(1);
    });

    it('muestra la toma igual si no se puede leer el perfil del cuidador', async () => {
      // El Cuidador pudo haber sido desvinculado: la RLS deja de dejar ver
      // su perfil. Cambiar un nombre accesorio por NO mostrar la medicación
      // sería el peor canje posible en esta pantalla.
      const profileRepo = new InMemoryProfileRepository(store);
      vi.spyOn(profileRepo, 'findById').mockResolvedValue(
        Err(DomainErrors.repositoryFailure(new Error('sin permiso'))),
      );
      tomaPendiente('t-1', 'd-1', 'caregiver-1', '2026-08-01T08:00:00.000Z');

      const conRepoRoto = new GetPendingDosesForPatientUseCase(
        new InMemoryDoseRepository(store),
        new InMemoryTreatmentRepository(store),
        new FakeClock(now),
        profileRepo,
      );

      const result = await conRepoRoto.execute({ patientId: 'patient-1', date: now });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.doses).toHaveLength(1);
      expect(result.value.doses[0]?.medicationName).toBeTruthy();
      expect(result.value.doses[0]?.caregiverName).toBeNull();
    });

    it('trata un nombre en blanco como si no hubiera nombre', async () => {
      store.profiles.set('caregiver-1', perfil('caregiver-1', '   '));
      tomaPendiente('t-1', 'd-1', 'caregiver-1', '2026-08-01T08:00:00.000Z');

      const result = await useCase.execute({ patientId: 'patient-1', date: now });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.doses[0]?.caregiverName).toBeNull();
    });
  });
});
