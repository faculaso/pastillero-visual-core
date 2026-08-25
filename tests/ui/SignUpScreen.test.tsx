import React from 'react';
import { render, screen, waitFor, userEvent } from '@testing-library/react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SignUpScreen } from '../../src/presentation/screens/auth/SignUpScreen';
import type { AuthStackParamList } from '../../src/presentation/navigation/types';
import { Ok, Err, DomainErrors } from '../../src/domain';
import { withProviders } from './test-utils';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignUp'>;

function buildNavigationMock(): Props['navigation'] {
  return { navigate: jest.fn(), replace: jest.fn() } as unknown as Props['navigation'];
}

const baseRoute = { key: 'sign-up-1', name: 'SignUp' as const, params: undefined };

function buildAuthMock(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    signUp: jest.fn().mockResolvedValue(Ok({ session: null })),
    getSession: jest.fn().mockResolvedValue(null),
    onAuthStateChange: jest.fn().mockReturnValue(() => {}),
    getPendingInviteCode: jest.fn().mockResolvedValue(null),
    clearPendingInviteCode: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('SignUpScreen', () => {
  it('el campo de código de invitación solo aparece para el rol Cuidador', async () => {
    const navigation = buildNavigationMock();
    const user = userEvent.setup();
    await render(
      withProviders(<SignUpScreen navigation={navigation} route={baseRoute} />, {
        useCases: { auth: buildAuthMock() as never },
      }),
    );

    expect(screen.queryByLabelText('Código de invitación')).toBeNull();

    await user.press(screen.getByLabelText('Soy el Cuidador'));
    expect(screen.getByLabelText('Código de invitación')).toBeTruthy();
  });

  it('da de alta a un Adulto Mayor sin código de invitación', async () => {
    const signUp = jest.fn().mockResolvedValue(Ok({ session: null }));
    const navigation = buildNavigationMock();
    const user = userEvent.setup();

    await render(
      withProviders(<SignUpScreen navigation={navigation} route={baseRoute} />, {
        useCases: { auth: buildAuthMock({ signUp }) as never },
      }),
    );

    await user.press(screen.getByLabelText('Soy el Adulto Mayor'));
    await user.type(screen.getByLabelText('Nombre'), 'Rosa Gómez');
    await user.type(screen.getByLabelText('Correo electrónico'), 'rosa@x.com');
    await user.type(screen.getByLabelText('Contraseña'), 'secreta123');
    await user.press(screen.getByRole('button', { name: 'Crear cuenta' }));

    await waitFor(() =>
      expect(signUp).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'rosa@x.com',
          password: 'secreta123',
          role: 'ADULTO_MAYOR',
          displayName: 'Rosa Gómez',
          pendingInviteCode: undefined,
        }),
      ),
    );
  });

  it('da de alta a un Cuidador incluyendo el código de invitación ingresado', async () => {
    const signUp = jest.fn().mockResolvedValue(Ok({ session: null }));
    const navigation = buildNavigationMock();
    const user = userEvent.setup();

    await render(
      withProviders(<SignUpScreen navigation={navigation} route={baseRoute} />, {
        useCases: { auth: buildAuthMock({ signUp }) as never },
      }),
    );

    await user.press(screen.getByLabelText('Soy el Cuidador'));
    await user.type(screen.getByLabelText('Nombre'), 'Juan Pérez');
    await user.type(screen.getByLabelText('Correo electrónico'), 'juan@x.com');
    await user.type(screen.getByLabelText('Contraseña'), 'secreta123');
    await user.type(screen.getByLabelText('Código de invitación'), '7f2k9m');
    await user.press(screen.getByRole('button', { name: 'Crear cuenta' }));

    await waitFor(() =>
      expect(signUp).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'CUIDADOR', pendingInviteCode: '7F2K9M' }),
      ),
    );
  });

  it('muestra "revisá tu correo" cuando falta confirmar el email', async () => {
    const signUp = jest.fn().mockResolvedValue(Ok({ session: null }));
    // El puerto real distinguiría esto devolviendo `session: null` — acá la distinción
    // "pendiente de confirmación" la hace SessionContext interpretando `session === null`.
    const navigation = buildNavigationMock();
    const user = userEvent.setup();

    await render(
      withProviders(<SignUpScreen navigation={navigation} route={baseRoute} />, {
        useCases: { auth: buildAuthMock({ signUp }) as never },
      }),
    );

    await user.press(screen.getByLabelText('Soy el Adulto Mayor'));
    await user.type(screen.getByLabelText('Nombre'), 'Rosa Gómez');
    await user.type(screen.getByLabelText('Correo electrónico'), 'rosa@x.com');
    await user.type(screen.getByLabelText('Contraseña'), 'secreta123');
    await user.press(screen.getByRole('button', { name: 'Crear cuenta' }));

    await waitFor(() => expect(screen.getByText('Revisá tu correo')).toBeTruthy());
  });

  it('muestra un error si el correo ya está en uso', async () => {
    const signUp = jest.fn().mockResolvedValue(Err(DomainErrors.authEmailAlreadyInUse('rosa@x.com')));
    const navigation = buildNavigationMock();
    const user = userEvent.setup();

    await render(
      withProviders(<SignUpScreen navigation={navigation} route={baseRoute} />, {
        useCases: { auth: buildAuthMock({ signUp }) as never },
      }),
    );

    await user.press(screen.getByLabelText('Soy el Adulto Mayor'));
    await user.type(screen.getByLabelText('Nombre'), 'Rosa Gómez');
    await user.type(screen.getByLabelText('Correo electrónico'), 'rosa@x.com');
    await user.type(screen.getByLabelText('Contraseña'), 'secreta123');
    await user.press(screen.getByRole('button', { name: 'Crear cuenta' }));

    await waitFor(() => expect(screen.getByText('Ya existe una cuenta con ese correo.')).toBeTruthy());
  });
});
