import React from 'react';
import { Pressable, Text } from 'react-native';
import { render, screen, waitFor, userEvent } from '@testing-library/react-native';
import { ChooseRoleScreen } from '../../src/presentation/screens/auth/ChooseRoleScreen';
import { useSession } from '../../src/presentation/providers/SessionContext';
import { Ok, type Profile } from '../../src/domain';
import { withProviders, type RenderWithProvidersOptions } from './test-utils';

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

/**
 * El selector no se alcanza con `initialRole`: aparece cuando
 * `SessionProvider` resuelve una cuenta real con los dos roles. Por eso
 * estos tests arrancan de una sesión de Supabase falsa y un `getProfile`
 * que decide el caso.
 */
function conCuenta(profile: Profile, extra: RenderWithProvidersOptions['useCases'] = {}) {
  return {
    useCases: {
      auth: {
        signOut: jest.fn().mockResolvedValue(Ok(undefined)),
        getSession: jest.fn().mockResolvedValue({ user: { id: profile.id, email: 'ana@x.com' } }),
        onAuthStateChange: jest.fn().mockReturnValue(() => {}),
        getPendingInviteCode: jest.fn().mockResolvedValue(null),
        clearPendingInviteCode: jest.fn().mockResolvedValue(undefined),
      } as never,
      getProfile: { execute: jest.fn().mockResolvedValue(Ok({ profile })) } as never,
      getLinkedPatient: { execute: jest.fn().mockResolvedValue(Ok({ patientId: 'p1' })) } as never,
      ...extra,
    },
  } satisfies RenderWithProvidersOptions;
}

/** Botón de prueba: reproduce el "Cambiar de rol" de los headers, que es el único camino al selector con un solo rol. */
function BotonCambiarDeRol(): React.JSX.Element {
  const { switchRole } = useSession();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Cambiar de rol" onPress={switchRole}>
      <Text>Cambiar de rol</Text>
    </Pressable>
  );
}

describe('ChooseRoleScreen', () => {
  it('ofrece las dos entradas cuando el mismo mail tiene los dos roles', async () => {
    await render(
      withProviders(<ChooseRoleScreen />, conCuenta(perfil({ isPatient: true, isCaregiver: true }))),
    );

    await waitFor(() => expect(screen.getByLabelText('Entrar como Adulto Mayor')).toBeTruthy());
    expect(screen.getByLabelText('Entrar como Cuidador')).toBeTruthy();
    expect(screen.getByText('Hola, Ana')).toBeTruthy();
    // Con los dos ya prendidos no hay nada que activar.
    expect(screen.queryByLabelText('Activar también Cuidador')).toBeNull();
  });

  it('al elegir Cuidador arma la sesión de cuidador y deja de preguntar', async () => {
    const getLinkedPatient = { execute: jest.fn().mockResolvedValue(Ok({ patientId: 'p1' })) };
    const user = userEvent.setup();

    await render(
      withProviders(
        <ChooseRoleScreen />,
        conCuenta(perfil({ isPatient: true, isCaregiver: true }), { getLinkedPatient: getLinkedPatient as never }),
      ),
    );

    await waitFor(() => expect(screen.getByLabelText('Entrar como Cuidador')).toBeTruthy());
    await user.press(screen.getByLabelText('Entrar como Cuidador'));

    // Resolver el paciente vinculado es la marca de que entró COMO cuidador:
    // el rol de Adulto Mayor no consulta vínculos.
    await waitFor(() => expect(getLinkedPatient.execute).toHaveBeenCalledWith({ caregiverId: 'u1' }));
    await waitFor(() => expect(screen.queryByLabelText('Entrar como Cuidador')).toBeNull());
  });

  it('con un solo rol ofrece activar el otro con el mismo correo', async () => {
    const user = userEvent.setup();

    await render(
      withProviders(
        <>
          <ChooseRoleScreen />
          <BotonCambiarDeRol />
        </>,
        conCuenta(perfil({ isPatient: false, isCaregiver: true })),
      ),
    );

    // Con un solo rol se entra derecho: el selector recién aparece si se pide.
    await waitFor(() => expect(screen.getByLabelText('Cambiar de rol')).toBeTruthy());
    await user.press(screen.getByLabelText('Cambiar de rol'));

    await waitFor(() => expect(screen.getByLabelText('Activar también Adulto Mayor')).toBeTruthy());
    expect(screen.getByLabelText('Entrar como Cuidador')).toBeTruthy();
  });
});
