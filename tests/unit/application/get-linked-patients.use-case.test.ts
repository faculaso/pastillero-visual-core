import { describe, it, expect } from 'vitest';
import { GetLinkedPatientsUseCase } from '../../../src/application';
import { Ok, Err, DomainErrors, type LinkedPatient, type PairingRepository } from '../../../src/domain';

function repo(patients: readonly LinkedPatient[]): PairingRepository {
  return { findPatientsByCaregiver: async () => Ok(patients) } as unknown as PairingRepository;
}

const rosa: LinkedPatient = { patientId: 'p1', displayName: 'Rosa', linkedAt: new Date('2026-09-01T10:00:00Z') };
const hugo: LinkedPatient = { patientId: 'p2', displayName: 'Hugo', linkedAt: new Date('2026-09-05T10:00:00Z') };

describe('GetLinkedPatientsUseCase', () => {
  it('devuelve TODOS los pacientes, no solo el primero', async () => {
    // El use case anterior devolvía `[0]`: con dos personas a cargo, la
    // segunda existía en la base y era invisible en la app.
    const result = await new GetLinkedPatientsUseCase(repo([rosa, hugo])).execute({ caregiverId: 'g1' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.patients.map((p) => p.patientId)).toEqual(['p1', 'p2']);
  });

  it('una cuenta sin vínculos devuelve lista vacía, no un error', async () => {
    const result = await new GetLinkedPatientsUseCase(repo([])).execute({ caregiverId: 'g1' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.patients).toEqual([]);
  });

  it('propaga el fallo del repositorio en vez de disfrazarlo de lista vacía', async () => {
    // "Sin red" y "no cuidás a nadie" se ven igual en pantalla si esto se
    // traga el error, y el segundo lleva a pedir un código que no hace falta.
    const roto = {
      findPatientsByCaregiver: async () => Err(DomainErrors.repositoryFailure(new Error('sin red'))),
    } as unknown as PairingRepository;

    const result = await new GetLinkedPatientsUseCase(roto).execute({ caregiverId: 'g1' });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('REPOSITORY_FAILURE');
  });
});
