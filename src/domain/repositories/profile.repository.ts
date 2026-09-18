import type { Result } from '../core/result';
import type { DomainError } from '../errors/domain.errors';
import type { Profile, UserRole } from '../entities/profile.entity';

/** Puerto de `profiles` — la cuenta ya autenticada consulta y edita su propia fila. */
export interface ProfileRepository {
  findById(id: string): Promise<Result<Profile | null, DomainError>>;
  /**
   * Prende una capacidad de la propia cuenta (el mismo mail pasa a poder
   * usar también el otro rol). Solo agrega: no existe apagar un rol, porque
   * hacerlo dejaría tratamientos y vínculos apuntando a una cuenta que ya no
   * puede verlos.
   */
  enableRole(userId: string, role: UserRole): Promise<Result<Profile, DomainError>>;
}
