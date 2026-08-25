import React from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';
import { UseCasesProvider, type UseCasesBundle } from '../../src/presentation/providers/UseCasesProvider';
import { SessionProvider, type UserRole } from '../../src/presentation/providers/SessionContext';

/**
 * En la app real, `SafeAreaProvider` mide sus insets vía `onLayout` de una
 * vista nativa — eso nunca dispara bajo el renderer de pruebas, así que hay
 * que pasarle `initialMetrics` a mano (0 en todos los insets es suficiente
 * acá: lo que importa para los tests es que `useSafeAreaInsets()` no tire el
 * error "No safe area value available", no el valor exacto del inset).
 */
const TEST_SAFE_AREA_METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 0, height: 0 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

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
    redeemInviteCode: { execute: notImplemented } as unknown as UseCasesBundle['redeemInviteCode'],
    getLinkedPatient: { execute: notImplemented } as unknown as UseCasesBundle['getLinkedPatient'],
    getProfile: { execute: notImplemented } as unknown as UseCasesBundle['getProfile'],
    getWeeklySchedule: { execute: notImplemented } as unknown as UseCasesBundle['getWeeklySchedule'],
    auth: {
      signUp: notImplemented,
      signIn: notImplemented,
      signOut: notImplemented,
      getSession: jest.fn().mockResolvedValue(null),
      onAuthStateChange: jest.fn().mockReturnValue(() => {}),
      getPendingInviteCode: jest.fn().mockResolvedValue(null),
      clearPendingInviteCode: jest.fn().mockResolvedValue(undefined),
    } as unknown as UseCasesBundle['auth'],
    ...overrides,
  };
}

export interface RenderWithProvidersOptions {
  readonly useCases?: Partial<UseCasesBundle>;
  readonly role?: UserRole;
  /** Pisa el `patientId` sintético del modo test (p. ej. `''` para un Cuidador sin vincular). */
  readonly patientId?: string;
}

export function withProviders(
  children: React.ReactNode,
  options: RenderWithProvidersOptions = {},
): React.JSX.Element {
  const useCases = createFakeUseCases(options.useCases);
  return (
    <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
      <UseCasesProvider useCases={useCases}>
        <SessionProvider initialRole={options.role} initialPatientId={options.patientId}>
          {children}
        </SessionProvider>
      </UseCasesProvider>
    </SafeAreaProvider>
  );
}
