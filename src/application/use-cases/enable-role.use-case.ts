import { Ok, type Result, type DomainError, type ProfileRepository } from '../../domain';
import type { UseCase } from '../core/use-case';
import type { EnableRoleInput, EnableRoleOutput } from '../dto/enable-role.dto';

/**
 * Suma un rol a la cuenta que ya está autenticada: el mismo mail pasa a
 * poder entrar como Adulto Mayor y como Cuidador.
 *
 * Solo suma. No hay "quitar un rol" a propósito: apagar `isPatient` dejaría
 * un historial de tomas y un código de invitación vivos apuntando a una
 * cuenta que ya no puede verlos, y apagar `isCaregiver` escondería
 * tratamientos que esa persona cargó y que su paciente sigue tomando.
 */
export class EnableRoleUseCase implements UseCase<EnableRoleInput, EnableRoleOutput> {
  constructor(private readonly profileRepository: ProfileRepository) {}

  async execute(input: EnableRoleInput): Promise<Result<EnableRoleOutput, DomainError>> {
    const result = await this.profileRepository.enableRole(input.userId, input.role);
    if (!result.ok) return result;
    return Ok({ profile: result.value });
  }
}
