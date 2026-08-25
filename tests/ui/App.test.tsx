import React from 'react';
import { render, screen, waitFor, userEvent } from '@testing-library/react-native';

/**
 * Se mockea el módulo entero de bootstrap: evita que el test real abra
 * op-sqlite (import de VALOR real, rompería en Jest/Node igual que
 * notifee/RNFS) y da control total sobre los 3 escenarios (loading/error/success).
 */
jest.mock('../../src/infrastructure/bootstrap', () => ({
  __esModule: true,
  bootstrap: jest.fn(),
}));

/**
 * `App` monta `RootNavigator` -> ... -> `RegisterTreatmentScreen` ->
 * `BoxPhotoCaptureField`, que importa `react-native-image-picker` (TS sin
 * compilar, mismo motivo que en `BoxPhotoCaptureField.test.tsx`).
 */
jest.mock('react-native-image-picker', () => ({
  __esModule: true,
  launchCamera: jest.fn().mockResolvedValue({ didCancel: true }),
  launchImageLibrary: jest.fn().mockResolvedValue({ didCancel: true }),
}));

/**
 * `SafeAreaProvider` real espera una medición nativa (`onLayout`) antes de
 * renderizar sus children — bajo Jest (sin motor de layout real) esa
 * medición nunca llega, y el árbol queda vacío para siempre. Se mockea acá
 * por un passthrough: a este test le importa que la navegación monte, no
 * los insets reales (eso es responsabilidad visual, no de este test).
 *
 * Se parte del módulo REAL (`requireActual`) y solo se pisan
 * `SafeAreaProvider`/`SafeAreaView`/`useSafeAreaInsets` — hace falta
 * mantener el `SafeAreaContext` real: `@react-navigation/native-stack`
 * (usado por `AuthStack`/`CuidadorStack`/`AdultoMayorStack`) internamente
 * hace `useContext(SafeAreaContext)` vía `SafeAreaProviderCompat`, y si ese
 * export no existe (mock reemplazando el módulo entero) truena con
 * "Cannot read properties of undefined ('$$typeof')" apenas monta CUALQUIER
 * `Stack.Navigator` — no es específico de una pantalla.
 */
jest.mock('react-native-safe-area-context', () => {
  const RN = require('react-native');
  const actual = jest.requireActual('react-native-safe-area-context');
  return {
    ...actual,
    __esModule: true,
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
    SafeAreaView: RN.View,
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  };
});

import { bootstrap } from '../../src/infrastructure/bootstrap';
import App from '../../src/presentation/App';

const mockBootstrap = bootstrap as jest.Mock;

function buildFakeBootstrapResult() {
  const notImplemented = jest.fn().mockRejectedValue(new Error('not implemented in this test'));
  return {
    confirmDose: { execute: notImplemented },
    registerTreatment: { execute: notImplemented },
    monitorAdherence: { execute: notImplemented },
    updateStock: { execute: notImplemented },
    getPendingDoses: { execute: notImplemented },
    searchMedicationCatalog: { execute: notImplemented },
    suggestVisualProfile: { execute: notImplemented },
    localImageStorage: { saveImage: notImplemented, deleteImage: notImplemented },
    voiceGuidance: { speak: notImplemented, stop: notImplemented },
    getDailyProgress: { execute: notImplemented },
    redeemInviteCode: { execute: notImplemented },
    getLinkedPatient: { execute: notImplemented },
    getProfile: { execute: notImplemented },
    getWeeklySchedule: { execute: notImplemented },
    auth: {
      signUp: notImplemented,
      signIn: notImplemented,
      signOut: notImplemented,
      // Sin sesión: `RootNavigator` debe mostrar `AuthStack` (pantalla de login).
      getSession: jest.fn().mockResolvedValue(null),
      onAuthStateChange: jest.fn().mockReturnValue(() => {}),
      getPendingInviteCode: jest.fn().mockResolvedValue(null),
      clearPendingInviteCode: jest.fn().mockResolvedValue(undefined),
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('App', () => {
  it('muestra un indicador de carga mientras bootstrap() está pendiente', async () => {
    mockBootstrap.mockReturnValue(new Promise(() => {})); // nunca resuelve durante el test
    const view = await render(<App />);

    expect(JSON.stringify(view.toJSON())).toContain('ActivityIndicator');
  });

  it('si bootstrap() falla, muestra el error y un botón "Reintentar"', async () => {
    mockBootstrap.mockRejectedValue(new Error('no se pudo abrir la base de datos'));
    await render(<App />);

    await waitFor(() => expect(screen.getByText('No pudimos iniciar la aplicación')).toBeTruthy());
    expect(screen.getByText('no se pudo abrir la base de datos')).toBeTruthy();
    expect(screen.getByText('Reintentar')).toBeTruthy();
  });

  it('"Reintentar" vuelve a llamar a bootstrap()', async () => {
    mockBootstrap.mockRejectedValue(new Error('fallo transitorio'));
    const user = userEvent.setup();
    await render(<App />);

    await waitFor(() => expect(screen.getByText('Reintentar')).toBeTruthy());
    expect(mockBootstrap).toHaveBeenCalledTimes(1);

    await user.press(screen.getByText('Reintentar'));

    await waitFor(() => expect(mockBootstrap).toHaveBeenCalledTimes(2));
  });

  it('si bootstrap() resuelve, monta la navegación (llega a la pantalla de login, sin sesión activa)', async () => {
    mockBootstrap.mockResolvedValue(buildFakeBootstrapResult());
    await render(<App />);

    await waitFor(() => expect(screen.getByText('Correo electrónico')).toBeTruthy());
  });
});
