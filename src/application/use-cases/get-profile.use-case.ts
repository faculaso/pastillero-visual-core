import { Ok, type Result, type DomainError, type ProfileRepository } from '../../domain';
import type { UseCase } from '../core/use-case';
import type { GetProfileInput, GetProfileOutput } from '../dto/get-profile.dto';

/** Lee el propio perfil (rol, nombre, código de invitación si es Adulto Mayor) del usuario ya autenticado. */
export class GetProfileUseCase implements UseCase<GetProfileInput, GetProfileOutput> {
  constructor(private readonly profileRepository: ProfileRepository) {}

  async execute(input: GetProfileInput): Promise<Result<GetProfileOutput, DomainError>> {
    const result = await this.profileRepository.findById(input.userId);
    if (!result.ok) return result;
    return Ok({ profile: result.value });
  }
}
