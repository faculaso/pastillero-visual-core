import { describe, it, expect } from 'vitest';
import { GetPairingOverviewUseCase } from '../../../src/application';
import { Ok, type LinkedCaregiver, type PairingRepository, type PatientInviteCode } from '../../../src/domain';

function codigo(overrides: Partial<PatientInviteCode> = {}): PatientInviteCode {
  return {
    id: 'c1',
    code: 'ABC234',
    createdAt: new Date('2026-09-01T10:00:00Z'),
    redeemedAt: null,
    redeemedBy: null,
    ...overrides,
  };
}

function cuidador(overrides: Partial<LinkedCaregiver> = {}): LinkedCaregiver {
  return {
    caregiverId: 'g1',
    displayName: 'Ana',
    linkedAt: new Date('2026-09-02T10:00:00Z'),
    ...overrides,
  };
}

function repo(
  caregivers: readonly LinkedCaregiver[],
  codes: readonly PatientInviteCode[],
): PairingRepository {
  return {
    findCaregiversByPatient: async () => Ok(caregivers),
    findInviteCodesByPatient: async () => Ok(codes),
  } as unknown as PairingRepository;
}

describe('GetPairingOverviewUseCase', () => {
  it('deja fuera de "pendientes" los códigos ya usados: no se pueden dar de baja', async () => {
    const usado = codigo({ id: 'c1', code: 'USADO1', redeemedAt: new Date(), redeemedBy: 'g1' });
    const libre = codigo({ id: 'c2', code: 'LIBRE1' });
    const useCase = new GetPairingOverviewUseCase(repo([cuidador()], [usado, libre]));

    const result = await useCase.execute({ patientId: 'p1' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.pendingCodes.map((c) => c.code)).toEqual(['LIBRE1']);
  });

  it('los códigos entregados sin usar ocupan lugar igual que un cuidador ya vinculado', async () => {
    // Si no contaran, alguien podría dictar 3 códigos, generar un cuarto, y
    // recién enterarse del tope cuando su cuidador no puede entrar.
    const useCase = new GetPairingOverviewUseCase(
      repo([cuidador()], [codigo({ id: 'c2', code: 'LIBRE1' }), codigo({ id: 'c3', code: 'LIBRE2' })]),
    );

    const result = await useCase.execute({ patientId: 'p1' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.slotsLeft).toBe(0);
    expect(result.value.maxCaregivers).toBe(3);
  });

  it('sin nadie vinculado y sin códigos quedan los tres lugares libres', async () => {
    const useCase = new GetPairingOverviewUseCase(repo([], []));

    const result = await useCase.execute({ patientId: 'p1' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.slotsLeft).toBe(3);
    expect(result.value.caregivers).toEqual([]);
  });

  it('nunca devuelve lugares negativos aunque la base tenga más de los esperados', async () => {
    // Un vínculo creado antes del tope (o a mano) no debería hacer que la
    // pantalla ofrezca "-1 lugares".
    const useCase = new GetPairingOverviewUseCase(
      repo(
        [cuidador({ caregiverId: 'g1' }), cuidador({ caregiverId: 'g2' }), cuidador({ caregiverId: 'g3' }), cuidador({ caregiverId: 'g4' })],
        [],
      ),
    );

    const result = await useCase.execute({ patientId: 'p1' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.slotsLeft).toBe(0);
  });
});
