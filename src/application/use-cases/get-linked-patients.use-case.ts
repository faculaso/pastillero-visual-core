import { Ok, type Result, type DomainError, type PairingRepository } from '../../domain';
import type { UseCase } from '../core/use-case';
import type { GetLinkedPatientsInput, GetLinkedPatientsOutput } from '../dto/get-linked-patients.dto';

/**
 * Todos los pacientes de un Cuidador, con nombre.
 *
 * Reemplaza a `GetLinkedPatientUseCase`, que devolvía solo el primero
 * (`[0]`). Eso alcanzaba mientras un Cuidador tenía una sola persona a
 * cargo, pero con dos o más se volvía un bug silencioso: los demás
 * pacientes existían en la base y eran invisibles en la app, sin ningún
 * aviso de que estaban ahí.
 */
export class GetLinkedPatientsUseCase implements UseCase<GetLinkedPatientsInput, GetLinkedPatientsOutput> {
  constructor(private readonly pairingRepository: PairingRepository) {}

  async execute(input: GetLinkedPatientsInput): Promise<Result<GetLinkedPatientsOutput, DomainError>> {
    const result = await this.pairingRepository.findPatientsByCaregiver(input.caregiverId);
    if (!result.ok) return result;
    return Ok({ patients: result.value });
  }
}
