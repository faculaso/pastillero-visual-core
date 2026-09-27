import type { Result } from '../../domain/core/result';
import type { DomainError } from '../../domain/errors/domain.errors';
import type { UserRole } from '../../domain/entities/profile.entity';

export interface AuthUser {
  readonly id: string;
  readonly email: string;
}

export interface AuthSession {
  readonly user: AuthUser;
}

export interface SignUpInput {
  readonly email: string;
  readonly password: string;
  readonly role: UserRole;
  readonly displayName: string;
  /**
   * Solo para `role === 'CUIDADOR'`. NO se redime durante este `signUp()`
   * — si el proyecto exige confirmación de email, todavía no hay sesión
   * activa en este momento y la RPC de redención necesita `auth.uid()`.
   * Se guarda como metadata del propio usuario (`user_metadata`, disponible
   * sin sesión) y se redime más tarde, la primera vez que haya una sesión
   * activa de verdad — ver `SessionContext`.
   */
  readonly pendingInviteCode?: string;
}

/**
 * Puerto de autenticación — implementación real: Supabase Auth
 * (`SupabaseAuthAdapter`). No hay versión SQLite/local: sesiones reales
 * sincronizadas entre dispositivos son, por definición, un concepto de
 * servidor.
 */
export interface AuthPort {
  signUp(input: SignUpInput): Promise<Result<{ readonly session: AuthSession | null }, DomainError>>;
  signIn(email: string, password: string): Promise<Result<{ readonly session: AuthSession }, DomainError>>;
  signOut(): Promise<Result<void, DomainError>>;
  /**
   * Dispara el email de recuperación de contraseña de Supabase Auth. No
   * distingue "el correo no existe" de "se envió OK" — Supabase responde
   * éxito en ambos casos a propósito (no revelar qué emails están
   * registrados), así que del lado del cliente solo hay un camino feliz y
   * un error de infraestructura (red, rate limit).
   */
  resetPasswordForEmail(email: string): Promise<Result<void, DomainError>>;
  /**
   * Cierra el reseteo con el código de 6 dígitos que llegó por mail.
   *
   * Es una sola operación del lado del puerto aunque abajo sean dos llamadas
   * (canjear el código, que deja sesión abierta, y recién ahí guardar la
   * contraseña): quien la usa no tiene nada que decidir en el medio, y
   * partirla solo expondría un estado intermedio — con sesión y la
   * contraseña vieja — que no le sirve a nadie.
   *
   * Por qué un código y no un link: el link de Supabase apunta al Site URL
   * del proyecto, que en un teléfono no existe (`localhost` es el propio
   * teléfono, y da ERR_CONNECTION_REFUSED). Un deep link sería la otra
   * salida, pero obliga a registrar un esquema y depende de que el cliente
   * de correo lo respete. El código no sale nunca de la app.
   */
  completePasswordReset(
    email: string,
    code: string,
    newPassword: string,
  ): Promise<Result<void, DomainError>>;
  getSession(): Promise<AuthSession | null>;
  /** Devuelve la función de limpieza (unsubscribe). */
  onAuthStateChange(callback: (session: AuthSession | null) => void): () => void;
  getPendingInviteCode(): Promise<string | null>;
  clearPendingInviteCode(): Promise<void>;
}
