import type { SupabaseClient, User } from '@supabase/supabase-js';
import { Ok, Err, type Result, DomainErrors, type DomainError } from '../../domain';
import type { AuthPort, AuthSession, AuthUser, SignUpInput } from '../../application';

function mapUser(user: User): AuthUser {
  return { id: user.id, email: user.email ?? '' };
}

function mapAuthError(message: string): DomainError {
  const lower = message.toLowerCase();
  if (lower.includes('already registered') || lower.includes('already exists')) {
    return DomainErrors.authEmailAlreadyInUse('');
  }
  if (lower.includes('invalid login credentials') || lower.includes('invalid credentials')) {
    return DomainErrors.authInvalidCredentials();
  }
  return DomainErrors.repositoryFailure(new Error(message));
}

/**
 * `profiles` NO se crea acá (ni en ningún otro punto del cliente): la crea
 * automáticamente un trigger en `auth.users` (ver
 * `supabase/migrations/0004_auto_create_profile_trigger.sql`) leyendo
 * `role`/`display_name` de `options.data` de este `signUp()` — necesario
 * porque, si el proyecto exige confirmación de email, todavía no hay
 * sesión activa acá (la policy de insert de `profiles` exige `auth.uid()`,
 * que un trigger `security definer` no necesita).
 */
export class SupabaseAuthAdapter implements AuthPort {
  constructor(private readonly client: SupabaseClient) {}

  async signUp(input: SignUpInput): Promise<Result<{ session: AuthSession | null }, DomainError>> {
    const { data, error } = await this.client.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        data: {
          role: input.role,
          display_name: input.displayName,
          pending_invite_code: input.pendingInviteCode ?? null,
        },
      },
    });
    if (error) return Err(mapAuthError(error.message));
    return Ok({ session: data.session ? { user: mapUser(data.session.user) } : null });
  }

  async signIn(email: string, password: string): Promise<Result<{ session: AuthSession }, DomainError>> {
    const { data, error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) return Err(mapAuthError(error.message));
    return Ok({ session: { user: mapUser(data.user) } });
  }

  async signOut(): Promise<Result<void, DomainError>> {
    const { error } = await this.client.auth.signOut();
    if (error) return Err(DomainErrors.repositoryFailure(error));
    return Ok(undefined);
  }

  async getSession(): Promise<AuthSession | null> {
    const { data } = await this.client.auth.getSession();
    return data.session ? { user: mapUser(data.session.user) } : null;
  }

  onAuthStateChange(callback: (session: AuthSession | null) => void): () => void {
    const { data } = this.client.auth.onAuthStateChange((_event, session) => {
      callback(session ? { user: mapUser(session.user) } : null);
    });
    return () => data.subscription.unsubscribe();
  }

  async getPendingInviteCode(): Promise<string | null> {
    const { data } = await this.client.auth.getUser();
    const code = data.user?.user_metadata?.pending_invite_code;
    return typeof code === 'string' && code.length > 0 ? code : null;
  }

  async clearPendingInviteCode(): Promise<void> {
    // Best-effort: si falla, la próxima resolución de sesión simplemente
    // vuelve a intentar redimir el mismo código — `redeem_invite_code` es
    // idempotente (`on conflict ... do nothing`), así que no hay riesgo de
    // duplicar el vínculo.
    await this.client.auth.updateUser({ data: { pending_invite_code: null } });
  }
}
