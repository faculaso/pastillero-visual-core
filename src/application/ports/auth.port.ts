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
  getSession(): Promise<AuthSession | null>;
  /** Devuelve la función de limpieza (unsubscribe). */
  onAuthStateChange(callback: (session: AuthSession | null) => void): () => void;
  getPendingInviteCode(): Promise<string | null>;
  clearPendingInviteCode(): Promise<void>;
}
