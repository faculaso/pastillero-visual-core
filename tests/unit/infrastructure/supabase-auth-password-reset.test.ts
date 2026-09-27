import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseAuthAdapter } from '../../../src/infrastructure/services/supabase-auth.adapter';

interface AuthDoble {
  verifyOtp: ReturnType<typeof vi.fn>;
  updateUser: ReturnType<typeof vi.fn>;
  signOut: ReturnType<typeof vi.fn>;
}

function clienteConAuth(overrides: Partial<AuthDoble> = {}): { client: SupabaseClient; auth: AuthDoble } {
  const auth: AuthDoble = {
    verifyOtp: vi.fn().mockResolvedValue({ error: null }),
    updateUser: vi.fn().mockResolvedValue({ error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    ...overrides,
  };
  return { client: { auth } as unknown as SupabaseClient, auth };
}

/**
 * El reseteo por código existe porque el link del correo apuntaba al Site
 * URL del proyecto — `http://localhost:3000` — que en un teléfono es el
 * propio teléfono: ERR_CONNECTION_REFUSED con el correo llegando perfecto.
 */
describe('SupabaseAuthAdapter — reseteo de contraseña con código', () => {
  it('canjea el código y recién entonces guarda la contraseña', async () => {
    const { client, auth } = clienteConAuth();
    const adapter = new SupabaseAuthAdapter(client);

    const result = await adapter.completePasswordReset('ana@example.com', '123456', 'nueva-clave');

    expect(result.ok).toBe(true);
    expect(auth.verifyOtp).toHaveBeenCalledWith({
      email: 'ana@example.com',
      token: '123456',
      type: 'recovery',
    });
    expect(auth.updateUser).toHaveBeenCalledWith({ password: 'nueva-clave' });
    // El orden importa: sin canjear el código antes, `updateUser` cambiaría
    // la contraseña de alguien que no demostró tener acceso al correo.
    expect(auth.verifyOtp.mock.invocationCallOrder[0]).toBeLessThan(
      auth.updateUser.mock.invocationCallOrder[0] as number,
    );
  });

  it('un código inválido NO llega a tocar la contraseña', async () => {
    const { client, auth } = clienteConAuth({
      verifyOtp: vi.fn().mockResolvedValue({ error: { message: 'Token has expired or is invalid' } }),
    });
    const adapter = new SupabaseAuthAdapter(client);

    const result = await adapter.completePasswordReset('ana@example.com', '000000', 'nueva-clave');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('RECOVERY_CODE_INVALID');
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it('si falla el guardado NO cierra la sesión: quien está del otro lado ya probó tener el correo', async () => {
    // Cerrarla lo obligaría a pedir otro código para reintentar algo que
    // falló del lado del servidor, no suyo.
    const { client, auth } = clienteConAuth({
      updateUser: vi.fn().mockResolvedValue({ error: { message: 'network' } }),
    });
    const adapter = new SupabaseAuthAdapter(client);

    const result = await adapter.completePasswordReset('ana@example.com', '123456', 'nueva-clave');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('REPOSITORY_FAILURE');
    expect(auth.signOut).not.toHaveBeenCalled();
  });
});
