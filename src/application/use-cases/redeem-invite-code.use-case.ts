import { Ok, type Result, type DomainError, type PairingRepository } from '../../domain';
import type { UseCase } from '../core/use-case';
import type { RedeemInviteCodeInput, RedeemInviteCodeOutput } from '../dto/redeem-invite-code.dto';

/** El Cuidador redime el código que le dio su Adulto Mayor — crea el vínculo entre las dos cuentas. */
export class RedeemInviteCodeUseCase implements UseCase<RedeemInviteCodeInput, RedeemInviteCodeOutput> {
  constructor(private readonly pairingRepository: PairingRepository) {}

  async execute(input: RedeemInviteCodeInput): Promise<Result<RedeemInviteCodeOutput, DomainError>> {
    const result = await this.pairingRepository.redeemInviteCode(input.inviteCode, input.caregiverId);
    if (!result.ok) return result;
    return Ok({ link: result.value });
  }
}
