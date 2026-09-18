import { Ok, type Result, type DomainError, type PairingRepository } from '../../domain';
import type { UseCase } from '../core/use-case';
import type { CreateInviteCodeOutput, RevokeInviteCodeInput, UnlinkCaregiverInput } from '../dto/pairing.dto';

/**
 * Genera un código de invitación nuevo para el Adulto Mayor autenticado.
 *
 * No recibe `patientId`: el dueño del código es siempre quien está logueado
 * (`auth.uid()` del lado de Postgres). Pasarlo por parámetro sugeriría que
 * se le puede generar un código a otra persona, que es justo lo que la RPC
 * no permite.
 */
export class CreateInviteCodeUseCase implements UseCase<void, CreateInviteCodeOutput> {
  constructor(private readonly pairingRepository: PairingRepository) {}

  async execute(): Promise<Result<CreateInviteCodeOutput, DomainError>> {
    const result = await this.pairingRepository.createInviteCode();
    if (!result.ok) return result;
    return Ok({ code: result.value });
  }
}

/** Da de baja un código que todavía nadie usó. El que ya se usó no se revoca: eso es desvincular al cuidador. */
export class RevokeInviteCodeUseCase implements UseCase<RevokeInviteCodeInput, void> {
  constructor(private readonly pairingRepository: PairingRepository) {}

  async execute(input: RevokeInviteCodeInput): Promise<Result<void, DomainError>> {
    return this.pairingRepository.revokeInviteCode(input.codeId);
  }
}

/**
 * Le saca el acceso a un Cuidador y libera su lugar.
 *
 * Los tratamientos que esa persona cargó NO se borran: son parte del
 * historial médico del Adulto Mayor y siguen sonando en su pastillero.
 * Lo que se corta es la visibilidad hacia adelante.
 */
export class UnlinkCaregiverUseCase implements UseCase<UnlinkCaregiverInput, void> {
  constructor(private readonly pairingRepository: PairingRepository) {}

  async execute(input: UnlinkCaregiverInput): Promise<Result<void, DomainError>> {
    return this.pairingRepository.unlinkCaregiver(input.caregiverId);
  }
}
