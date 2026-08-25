import type { Result } from '../core/result';
import type { DomainError } from '../errors/domain.errors';
import type { Profile } from '../entities/profile.entity';

/** Puerto de lectura de `profiles` — la cuenta ya autenticada consulta su propia fila para saber su rol/nombre/código de invitación. */
export interface ProfileRepository {
  findById(id: string): Promise<Result<Profile | null, DomainError>>;
}
