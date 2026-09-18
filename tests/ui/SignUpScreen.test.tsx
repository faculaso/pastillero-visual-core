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

  /**
   * Supabase trae este chequeo de fábrica pero solo en Plan Pro, así que se
   * implementó del lado de la app para no atar una medida de seguridad
   * básica a una decisión de facturación.
   */
  describe('contraseñas filtradas', () => {
    it('no crea la cuenta si la contraseña ya apareció en una filtración', async () => {
      const signUp = jest.fn();
      const leakedPasswordCheck = { isLeaked: jest.fn().mockResolvedValue(Ok(true)) };
      const user = userEvent.setup();

      await render(
        withProviders(<SignUpScreen navigation={buildNavigationMock()} route={baseRoute} />, {
          useCases: {
            auth: buildAuthMock({ signUp }) as never,
            leakedPasswordCheck: leakedPasswordCheck as never,
          },
        }),
      );

      await user.press(screen.getByLabelText('Soy el Adulto Mayor'));
      await user.type(screen.getByLabelText('Nombre'), 'Rosa Gómez');
      await user.type(screen.getByLabelText('Correo electrónico'), 'rosa@x.com');
      await user.type(screen.getByLabelText('Contraseña'), 'password123');
      await user.press(screen.getByRole('button', { name: 'Crear cuenta' }));

      await waitFor(() =>
        expect(
          screen.getByText(
            'Esa contraseña apareció en filtraciones de otros sitios y ya no es segura. Elegí otra distinta.',
          ),
        ).toBeTruthy(),
      );
      // No se llegó a crear nada: se corta ANTES de tocar Supabase.
      expect(signUp).not.toHaveBeenCalled();
    });

    /**
     * FAIL-OPEN. Dejar a alguien sin poder crear su cuenta porque un
     * servicio ajeno no contesta es peor que aceptarle una contraseña
     * mediocre — más todavía acá, donde la cuenta suele crearla un adulto
     * mayor con ayuda de alguien que vino un rato.
     */
    it('si el servicio no responde, el alta CONTINÚA', async () => {
      const signUp = jest.fn().mockResolvedValue(Ok({ session: { user: { id: 'u1' } } }));
      const leakedPasswordCheck = {
        isLeaked: jest.fn().mockResolvedValue(Err(DomainErrors.repositoryFailure(new Error('sin red')))),
      };
      const user = userEvent.setup();

      await render(
        withProviders(<SignUpScreen navigation={buildNavigationMock()} route={baseRoute} />, {
          useCases: {
            auth: buildAuthMock({ signUp }) as never,
            leakedPasswordCheck: leakedPasswordCheck as never,
          },
        }),
      );

      await user.press(screen.getByLabelText('Soy el Adulto Mayor'));
      await user.type(screen.getByLabelText('Nombre'), 'Rosa Gómez');
      await user.type(screen.getByLabelText('Correo electrónico'), 'rosa@x.com');
      await user.type(screen.getByLabelText('Contraseña'), 'secreta123');
      await user.press(screen.getByRole('button', { name: 'Crear cuenta' }));

      await waitFor(() => expect(signUp).toHaveBeenCalled());
    });
  });
});