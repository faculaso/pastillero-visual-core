import React from 'react';
import { render, screen, waitFor, userEvent } from '@testing-library/react-native';
import { ForgotPasswordScreen } from '../../src/presentation/screens/auth/ForgotPasswordScreen';
import { withProviders } from './test-utils';

function buildNavigationMock() {
  return { navigate: jest.fn(), replace: jest.fn(), goBack: jest.fn() } as unknown as Parameters<
    typeof ForgotPasswordScreen
  >[0]['navigation'];
}

function buildAuth(overrides: Record<string, unknown> = {}) {
  return {
    signUp: jest.fn(),
    signIn: jest.fn(),
    signOut: jest.fn(),
    getSession: jest.fn().mockResolvedValue(null),
    onAuthStateChange: jest.fn().mockReturnValue(() => {}),
    getPendingInviteCode: jest.fn().mockResolvedValue(null),
    clearPendingInviteCode: jest.fn().mockResolvedValue(undefined),
    resetPasswordForEmail: jest.fn().mockResolvedValue({ ok: true, value: undefined }),
    completePasswordReset: jest.fn().mockResolvedValue({ ok: true, value: undefined }),
    ...overrides,
  };
}

async function renderPantalla(auth: ReturnType<typeof buildAuth>) {
  return render(
    withProviders(<ForgotPasswordScreen navigation={buildNavigationMock()} route={{ key: 'k', name: 'ForgotPassword' }} />, {
      useCases: { auth: auth as never },
    }),
  );
}

/** Paso 1 completo: deja la pantalla pidiendo el código y la contraseña. */
async function pedirElCodigo(auth: ReturnType<typeof buildAuth>) {
  await renderPantalla(auth);
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Correo electrónico'), 'adriana@example.com');
  await user.press(screen.getByText('Enviarme el código'));
  await waitFor(() => expect(screen.getByLabelText('Código del correo')).toBeTruthy());
  return user;
}

describe('ForgotPasswordScreen', () => {
  it('pide el código al correo y pasa a la pantalla de elegir contraseña', async () => {
    const auth = buildAuth();

    await pedirElCodigo(auth);

    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith('adriana@example.com');
    expect(screen.getByLabelText('Contraseña nueva')).toBeTruthy();
  });

  it('cambia la contraseña con el código y el correo del primer paso', async () => {
    const auth = buildAuth();
    const user = await pedirElCodigo(auth);

    await user.type(screen.getByLabelText('Código del correo'), '123456');
    await user.type(screen.getByLabelText('Contraseña nueva'), 'nueva-clave');
    await user.press(screen.getByText('Cambiar la contraseña'));

    await waitFor(() => expect(screen.getByText('Listo, ya podés entrar')).toBeTruthy());
    expect(auth.completePasswordReset).toHaveBeenCalledWith('adriana@example.com', '123456', 'nueva-clave');
  });

  it('acepta un código de 8 dígitos — Supabase no manda siempre 6', async () => {
    // El bug que esto habría evitado: la pantalla exigía `length === 6` y el
    // proyecto emite códigos de 8, así que el botón quedaba deshabilitado para
    // siempre y era imposible cambiar la contraseña. Los tests de acá usaban
    // todos '123456' y pasaban igual con la validación rota.
    //
    // La documentación de Supabase se contradice sobre el largo (6 en la tabla
    // de variables de plantilla, 8 en la guía de plantillas) y además depende
    // de la configuración del proyecto: el cliente no puede saberlo.
    const auth = buildAuth();
    const user = await pedirElCodigo(auth);

    await user.type(screen.getByLabelText('Código del correo'), '76414912');
    await user.type(screen.getByLabelText('Contraseña nueva'), 'nueva-clave');
    await user.press(screen.getByText('Cambiar la contraseña'));

    await waitFor(() => expect(screen.getByText('Listo, ya podés entrar')).toBeTruthy());
    expect(auth.completePasswordReset).toHaveBeenCalledWith(
      'adriana@example.com',
      '76414912',
      'nueva-clave',
    );
  });

  it('un código vencido se explica y dice qué hacer, sin culpar a la contraseña', async () => {
    const auth = buildAuth({
      completePasswordReset: jest
        .fn()
        .mockResolvedValue({ ok: false, error: { code: 'RECOVERY_CODE_INVALID', message: 'no' } }),
    });
    const user = await pedirElCodigo(auth);

    await user.type(screen.getByLabelText('Código del correo'), '000000');
    await user.type(screen.getByLabelText('Contraseña nueva'), 'nueva-clave');
    await user.press(screen.getByText('Cambiar la contraseña'));

    await waitFor(() => expect(screen.getByText(/Ese código no es válido o ya venció/i)).toBeTruthy());
  });

  it('no deja mandar un código incompleto ni una contraseña corta', async () => {
    const auth = buildAuth();
    const user = await pedirElCodigo(auth);

    await user.type(screen.getByLabelText('Código del correo'), '123');
    await user.type(screen.getByLabelText('Contraseña nueva'), 'nueva-clave');
    await user.press(screen.getByText('Cambiar la contraseña'));
    expect(auth.completePasswordReset).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText('Código del correo'), '456');
    await user.clear(screen.getByLabelText('Contraseña nueva'));
    await user.type(screen.getByLabelText('Contraseña nueva'), 'corta');
    await user.press(screen.getByText('Cambiar la contraseña'));
    expect(auth.completePasswordReset).not.toHaveBeenCalled();
  });

  it('"Usar otro correo" vuelve al primer paso y limpia lo tipeado', async () => {
    const auth = buildAuth();
    const user = await pedirElCodigo(auth);

    await user.type(screen.getByLabelText('Código del correo'), '123456');
    await user.press(screen.getByText('Usar otro correo'));

    await waitFor(() => expect(screen.getByText('Enviarme el código')).toBeTruthy());
    expect(screen.queryByLabelText('Código del correo')).toBeNull();
  });

  it('si no se pudo mandar el correo, no avanza al paso del código', async () => {
    const auth = buildAuth({
      resetPasswordForEmail: jest
        .fn()
        .mockResolvedValue({ ok: false, error: { code: 'REPOSITORY_FAILURE', message: 'sin red' } }),
    });

    await renderPantalla(auth);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Correo electrónico'), 'adriana@example.com');
    await user.press(screen.getByText('Enviarme el código'));

    await waitFor(() => expect(screen.getByText(/No pudimos enviar el correo/i)).toBeTruthy());
    expect(screen.queryByLabelText('Código del correo')).toBeNull();
  });
});
