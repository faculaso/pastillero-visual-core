import React from 'react';
import { Alert } from 'react-native';
import { act, render, screen, waitFor, userEvent } from '@testing-library/react-native';

/**
 * La pantalla usa `useFocusEffect` (se recarga al volver, p. ej. después de
 * generar un código) — ese hook necesita un `NavigationContainer` real, que
 * este test no monta: pasa `navigation` como prop suelta, igual que el resto
 * de los tests de pantalla. Se lo reduce acá a un efecto de montaje.
 */
jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  const ReactActual = jest.requireActual('react');
  return {
    ...actual,
    useFocusEffect: (effect: () => void) => ReactActual.useEffect(effect, []),
  };
});

import { MisCuidadoresScreen } from '../../src/presentation/screens/mis-cuidadores/MisCuidadoresScreen';
import { Ok, Err, DomainErrors } from '../../src/domain';
import { withProviders } from './test-utils';

type Navigation = React.ComponentProps<typeof MisCuidadoresScreen>['navigation'];

function buildNavigationMock(): Navigation {
  return { navigate: jest.fn(), goBack: jest.fn() } as unknown as Navigation;
}

const codigoLibre = {
  id: 'c1',
  code: 'ABC234',
  createdAt: new Date('2026-09-01T10:00:00Z'),
  redeemedAt: null,
  redeemedBy: null,
};

/**
 * Dispara el botón del `Alert.alert` cuyo texto coincide — los
 * confirmatorios de esta pantalla son nativos, no tocables por el renderer.
 * Va dentro de `act` porque el handler arranca estado (`setBusy`).
 */
async function pressAlertButton(texto: string): Promise<void> {
  const spy = Alert.alert as unknown as jest.Mock;
  const botones = spy.mock.calls[spy.mock.calls.length - 1]?.[2] as
    | ReadonlyArray<{ text: string; onPress?: () => void }>
    | undefined;
  await act(async () => {
    botones?.find((b) => b.text === texto)?.onPress?.();
  });
}

describe('MisCuidadoresScreen', () => {
  beforeEach(() => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('muestra por nombre a quién te cuida y cuántos lugares quedan', async () => {
    const getPairingOverview = {
      execute: jest.fn().mockResolvedValue(
        Ok({
          caregivers: [{ caregiverId: 'g1', displayName: 'Ana', linkedAt: new Date() }],
          pendingCodes: [codigoLibre],
          slotsLeft: 1,
          maxCaregivers: 3,
        }),
      ),
    };

    await render(
      withProviders(<MisCuidadoresScreen patientId="p1" navigation={buildNavigationMock()} />, {
        useCases: { getPairingOverview: getPairingOverview as never },
      }),
    );

    await waitFor(() => expect(screen.getByText('Ana')).toBeTruthy());
    expect(screen.getByText('ABC234')).toBeTruthy();
    // El cupo se dice en palabras, no solo con un color: 1 vínculo + 1 código entregado.
    expect(screen.getByText('2 de 3 lugares ocupados.')).toBeTruthy();
  });

  it('sin lugares libres explica cómo liberar uno en vez de ofrecer generar', async () => {
    const getPairingOverview = {
      execute: jest.fn().mockResolvedValue(
        Ok({
          caregivers: [
            { caregiverId: 'g1', displayName: 'Ana', linkedAt: new Date() },
            { caregiverId: 'g2', displayName: 'Beto', linkedAt: new Date() },
            { caregiverId: 'g3', displayName: 'Cris', linkedAt: new Date() },
          ],
          pendingCodes: [],
          slotsLeft: 0,
          maxCaregivers: 3,
        }),
      ),
    };

    await render(
      withProviders(<MisCuidadoresScreen patientId="p1" navigation={buildNavigationMock()} />, {
        useCases: { getPairingOverview: getPairingOverview as never },
      }),
    );

    await waitFor(() => expect(screen.getByText('Llegaste al máximo de 3.')).toBeTruthy());
    expect(screen.queryByText('Generar un código nuevo')).toBeNull();
  });

  it('genera un código nuevo y vuelve a leer la pantalla', async () => {
    const getPairingOverview = {
      execute: jest
        .fn()
        .mockResolvedValueOnce(Ok({ caregivers: [], pendingCodes: [], slotsLeft: 3, maxCaregivers: 3 }))
        .mockResolvedValue(Ok({ caregivers: [], pendingCodes: [codigoLibre], slotsLeft: 2, maxCaregivers: 3 })),
    };
    const createInviteCode = { execute: jest.fn().mockResolvedValue(Ok({ code: codigoLibre })) };
    const user = userEvent.setup();

    await render(
      withProviders(<MisCuidadoresScreen patientId="p1" navigation={buildNavigationMock()} />, {
        useCases: {
          getPairingOverview: getPairingOverview as never,
          createInviteCode: createInviteCode as never,
        },
      }),
    );

    await waitFor(() => expect(screen.getByText('Generar un código nuevo')).toBeTruthy());
    await user.press(screen.getByText('Generar un código nuevo'));

    await waitFor(() => expect(createInviteCode.execute).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText('ABC234')).toBeTruthy());
  });

  it('quitarle el acceso a un cuidador pide confirmación antes de cortar', async () => {
    const getPairingOverview = {
      execute: jest.fn().mockResolvedValue(
        Ok({
          caregivers: [{ caregiverId: 'g1', displayName: 'Ana', linkedAt: new Date() }],
          pendingCodes: [],
          slotsLeft: 2,
          maxCaregivers: 3,
        }),
      ),
    };
    const unlinkCaregiver = { execute: jest.fn().mockResolvedValue(Ok(undefined)) };
    const user = userEvent.setup();

    await render(
      withProviders(<MisCuidadoresScreen patientId="p1" navigation={buildNavigationMock()} />, {
        useCases: {
          getPairingOverview: getPairingOverview as never,
          unlinkCaregiver: unlinkCaregiver as never,
        },
      }),
    );

    await waitFor(() => expect(screen.getByText('Quitarle el acceso')).toBeTruthy());
    await user.press(screen.getByText('Quitarle el acceso'));

    // Cortar un vínculo no se hace de un toque: primero confirma.
    expect(unlinkCaregiver.execute).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalled();

    await pressAlertButton('Quitar el acceso');
    await waitFor(() => expect(unlinkCaregiver.execute).toHaveBeenCalledWith({ caregiverId: 'g1' }));
  });

  it('avisa sin romper la pantalla si el servidor rechaza generar por el tope', async () => {
    const getPairingOverview = {
      execute: jest.fn().mockResolvedValue(Ok({ caregivers: [], pendingCodes: [], slotsLeft: 1, maxCaregivers: 3 })),
    };
    const createInviteCode = { execute: jest.fn().mockResolvedValue(Err(DomainErrors.inviteCodeLimitReached(3))) };
    const user = userEvent.setup();

    await render(
      withProviders(<MisCuidadoresScreen patientId="p1" navigation={buildNavigationMock()} />, {
        useCases: {
          getPairingOverview: getPairingOverview as never,
          createInviteCode: createInviteCode as never,
        },
      }),
    );

    await waitFor(() => expect(screen.getByText('Generar un código nuevo')).toBeTruthy());
    await user.press(screen.getByText('Generar un código nuevo'));

    await waitFor(() => expect(screen.getByText('Ya tenés todos tus lugares ocupados.')).toBeTruthy());
  });
});
