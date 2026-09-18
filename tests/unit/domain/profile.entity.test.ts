import { describe, it, expect } from 'vitest';
import { availableRoles, type Profile } from '../../../src/domain';

function perfil(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 'u1',
    role: 'CUIDADOR',
    displayName: 'Ana',
    inviteCode: null,
    isPatient: false,
    isCaregiver: true,
    ...overrides,
  };
}

describe('availableRoles', () => {
  it('devuelve un solo rol cuando la cuenta tiene una sola capacidad', () => {
    expect(availableRoles(perfil())).toEqual(['CUIDADOR']);
    expect(availableRoles(perfil({ role: 'ADULTO_MAYOR', isPatient: true, isCaregiver: false }))).toEqual([
      'ADULTO_MAYOR',
    ]);
  });

  it('devuelve los dos, en orden estable, cuando el mismo mail cumple los dos roles', () => {
    const ambos = perfil({ isPatient: true, isCaregiver: true, inviteCode: 'ABC234' });
    expect(availableRoles(ambos)).toEqual(['ADULTO_MAYOR', 'CUIDADOR']);
  });

  it('cae en `role` si el perfil viene de un respaldo offline anterior a la migración 0010', () => {
    // Un snapshot guardado por la versión anterior no tiene los booleanos;
    // deserializado queda con los dos en false. Devolver `[]` ahí dejaría a
    // la persona sin poder entrar justo cuando no tiene red.
    const viejo = perfil({ role: 'ADULTO_MAYOR', isPatient: false, isCaregiver: false });
    expect(availableRoles(viejo)).toEqual(['ADULTO_MAYOR']);
  });
});
