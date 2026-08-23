import React from 'react';
import { UseCasesProvider, type UseCasesBundle } from '../../src/presentation/providers/UseCasesProvider';
import { SessionProvider, type UserRole } from '../../src/presentation/providers/SessionContext';

/**
 * Fakes tipados como `jest.fn()` por método `execute` — no son dobles de
 * dominio completos (para eso está `tests/support/in-memory-repos.ts` del
 * lado de Vitest), son mocks de UI: solo importa qué devuelven y con qué
 * fueron llamados, no su lógica interna.
 */
export function createFakeUseCases(overrides: Partial<UseCasesBundle> = {}): UseCasesBundle {
  const notImplemented = jest.fn().mockRejectedValue(new Error('not implemented in this test'));
  return {
    confirmDose: { execute: notImplemented } as unknown as UseCasesBundle['confirmDose'],
    registerTreatment: { execute: notImplemented } as unknown as UseCasesBundle['registerTreatment'],
    monitorAdherence: { execute: notImplemented } as unknown as UseCasesBundle['monitorAdherence'],
    updateStock: { execute: notImplemented } as unknown as UseCasesBundle['updateStock'],
    getPendingDoses: { execute: notImplemented } as unknown as UseCasesBundle['getPendingDoses'],
    searchMedicationCatalog: { execute: notImplemented } as unknown as UseCasesBundle['searchMedicationCatalog'],
    suggestVisualProfile: { execute: notImplemented } as unknown as UseCasesBundle['suggestVisualProfile'],
    localImageStorage: {
      saveImage: notImplemented,
      deleteImage: notImplemented,
    } as unknown as UseCasesBundle['localImageStorage'],
    voiceGuidance: {
      speak: notImplemented,
      stop: notImplemented,
    } as unknown as UseCasesBundle['voiceGuidance'],
    getDailyProgress: { execute: notImplemented } as unknown as UseCasesBundle['getDailyProgress'],
    ...overrides,
  };
}

export interface RenderWithProvidersOptions {
  readonly useCases?: Partial<UseCasesBundle>;
  readonly role?: UserRole;
}

export function withProviders(
  children: React.ReactNode,
  options: RenderWithProvidersOptions = {},
): React.JSX.Element {
  const useCases = createFakeUseCases(options.useCases);
  return (
    <UseCasesProvider useCases={useCases}>
      <SessionProvider initialRole={options.role}>{children}</SessionProvider>
    </UseCasesProvider>
  );
}
