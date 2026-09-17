import { describe, it, expect, beforeEach } from 'vitest';
import { GetPausedTreatmentsUseCase } from '../../../src/application';
import { TreatmentStatus } from '../../../src/domain';
import { InMemoryStore, InMemoryTreatmentRepository } from '../../support/in-memory-repos';
import { buildTreatment, buildMedication } from '../../support/fixtures';

/**
 * Pausar sin esto era una puerta de una sola dirección: el tratamiento
 * pausado desaparece de la grilla y del aviso de stock, y no quedaba
 * ningún camino para volver a abrirlo y reanudarlo.
 */
describe('GetPausedTreatmentsUseCase', () => {
  let store: InMemoryStore;
  let useCase: GetPausedTreatmentsUseCase;

  beforeEach(() => {
    store = new InMemoryStore();
    useCase = new GetPausedTreatmentsUseCase(new InMemoryTreatmentRepository(store));
  });

  function seed(id: string, status: TreatmentStatus, name = 'Paracetamol'): void {
    store.treatments.set(
      id,
      buildTreatment({
        id,
        status,
        patientId: 'patient-1',
        caregiverId: 'caregiver-1',
        medication: buildMedication({ name }),
      }),
    );
  }

  it('devuelve los pausados con su nombre, para poder volver a ellos', async () => {
    seed('t1', TreatmentStatus.PAUSED, 'Ibuprofeno');

    const result = await useCase.execute({ caregiverId: 'caregiver-1', patientId: 'patient-1' });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.treatments).toEqual([{ treatmentId: 't1', medicationName: 'Ibuprofeno' }]);
    }
  });

  it('no lista los activos: esos ya se ven en el pastillero', async () => {
    seed('t1', TreatmentStatus.ACTIVE);

    const result = await useCase.execute({ caregiverId: 'caregiver-1', patientId: 'patient-1' });

    expect(result.ok && result.value.treatments).toHaveLength(0);
  });

  it('no lista los dados de baja: esa transición es final y no hay nada que hacer con ellos', async () => {
    seed('t1', TreatmentStatus.CANCELLED);
    seed('t2', TreatmentStatus.COMPLETED);

    const result = await useCase.execute({ caregiverId: 'caregiver-1', patientId: 'patient-1' });

    expect(result.ok && result.value.treatments).toHaveLength(0);
  });

  it('no mezcla pacientes: un cuidador puede tener más de uno a cargo', async () => {
    store.treatments.set(
      'otro',
      buildTreatment({
        id: 'otro',
        status: TreatmentStatus.PAUSED,
        patientId: 'patient-2',
        caregiverId: 'caregiver-1',
      }),
    );
    seed('t1', TreatmentStatus.PAUSED);

    const result = await useCase.execute({ caregiverId: 'caregiver-1', patientId: 'patient-1' });

    expect(result.ok && result.value.treatments).toEqual([
      { treatmentId: 't1', medicationName: 'Paracetamol' },
    ]);
  });
});
