import { Ok, type Result, type DomainError, type PairingRepository } from '../../domain';
import type { UseCase } from '../core/use-case';
import type { GetLinkedPatientInput, GetLinkedPatientOutput } from '../dto/get-linked-patient.dto';

/**
 * Resuelve qué paciente ve un Cuidador al loguearse. Alcance MVP
 * deliberado: un cuidador con varios pacientes vinculados solo ve el
 * primero (`[0]`) — un selector de paciente es la extensión natural si
 * hace falta más adelante, ver nota en `SessionContext`.
 */
export class GetLinkedPatientUseCase implements UseCase<GetLinkedPatientInput, GetLinkedPatientOutput> {
  constructor(private readonly pairingRepository: PairingRepository) {}

  async execute(input: GetLinkedPatientInput): Promise<Result<GetLinkedPatientOutput, DomainError>> {
    const result = await this.pairingRepository.findLinkedPatientsByCaregiver(input.caregiverId);
    if (!result.ok) return result;
    return Ok({ patientId: result.value[0] ?? null });
  }
}
