import {
  Ok,
  MAX_CAREGIVERS_PER_PATIENT,
  type Result,
  type DomainError,
  type PairingRepository,
} from '../../domain';
import type { UseCase } from '../core/use-case';
import type { GetPairingOverviewInput, GetPairingOverviewOutput } from '../dto/pairing.dto';

/**
 * Lo que ve el Adulto Mayor sobre quién lo cuida: los vínculos ya hechos y
 * los códigos entregados que todavía nadie usó.
 *
 * Los dos ocupan lugar contra el mismo tope. Es a propósito: si dictaste
 * tres códigos y todavía nadie los usó, ya comprometiste tus tres lugares —
 * dejarte generar un cuarto sería prometerte algo que la base va a rechazar
 * después, cuando alguien intente redimirlo.
 */
export class GetPairingOverviewUseCase implements UseCase<GetPairingOverviewInput, GetPairingOverviewOutput> {
  constructor(private readonly pairingRepository: PairingRepository) {}

  async execute(input: GetPairingOverviewInput): Promise<Result<GetPairingOverviewOutput, DomainError>> {
    const caregiversResult = await this.pairingRepository.findCaregiversByPatient(input.patientId);
    if (!caregiversResult.ok) return caregiversResult;

    const codesResult = await this.pairingRepository.findInviteCodesByPatient(input.patientId);
    if (!codesResult.ok) return codesResult;

    const caregivers = caregiversResult.value;
    const pendingCodes = codesResult.value.filter((code) => code.redeemedAt === null);
    const ocupados = caregivers.length + pendingCodes.length;

    return Ok({
      caregivers,
      pendingCodes,
      slotsLeft: Math.max(MAX_CAREGIVERS_PER_PATIENT - ocupados, 0),
      maxCaregivers: MAX_CAREGIVERS_PER_PATIENT,
    });
  }
}
