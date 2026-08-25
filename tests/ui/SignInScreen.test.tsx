import React from 'react';
import { render, screen, waitFor, userEvent } from '@testing-library/react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SignInScreen } from '../../src/presentation/screens/auth/SignInScreen';
import type { AuthStackParamList } from '../../src/presentation/navigation/types';
import { Ok, Err, DomainErrors } from '../../src/domain';
import { withProviders } from './test-utils';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignIn'>;

function buildNavigationMock(): Props['navigation'] {
  return { navigate: jest.fn(), replace: jest.fn() } as unknown as Props['navigation'];
}

const baseRoute = { key: 'sign-in-1', name: 'SignIn' as const, params: undefined };

describe('SignInScreen', () => {
  it('envía el email y la contraseña ingresados a signIn()', async () => {
    const signIn = jest.fn().mockResolvedValue(Ok({ session: { user: { id: 'u1', email: 'ana@x.com' } } }));
    const navigation = buildNavigationMock();
    const user = userEvent.setup();

    await render(
      withProviders(<SignInScreen navigation={navigation} route={baseRoute} />, {
        useCases: { auth: { signIn, getSession: jest.fn().mockResolvedValue(null), onAuthStateChange: jest.fn().mockReturnValue(() => {}) } as never },
      }),
    );

    await user.type(screen.getByLabelText('Correo electrónico'), 'ana@x.com');
    await user.type(screen.getByLabelText('Contraseña'), 'secreta123');
    await user.press(screen.getByRole('button', { name: 'Iniciar sesión' }));

    await waitFor(() => expect(signIn).toHaveBeenCalledWith('ana@x.com', 'secreta123'));
  });

  it('muestra un mensaje de error si las credenciales son inválidas', async () => {
    const signIn = jest.fn().mockResolvedValue(Err(DomainErrors.authInvalidCredentials()));
    const navigation = buildNavigationMock();
    const user = userEvent.setup();

    await render(
      withProviders(<SignInScreen navigation={navigation} route={baseRoute} />, {
        useCases: { auth: { signIn, getSession: jest.fn().mockResolvedValue(null), onAuthStateChange: jest.fn().mockReturnValue(() => {}) } as never },
      }),
    );

    await user.type(screen.getByLabelText('Correo electrónico'), 'ana@x.com');
    await user.type(screen.getByLabelText('Contraseña'), 'mala');
    await user.press(screen.getByRole('button', { name: 'Iniciar sesión' }));

    await waitFor(() => expect(screen.getByText('Correo o contraseña incorrectos.')).toBeTruthy());
  });

  it('el botón "Creá una" navega a la pantalla de alta', async () => {
    const navigation = buildNavigationMock();
    const user = userEvent.setup();

    await render(withProviders(<SignInScreen navigation={navigation} route={baseRoute} />));

    await user.press(screen.getByText('Creá una'));
    expect(navigation.navigate).toHaveBeenCalledWith('SignUp');
  });
});
