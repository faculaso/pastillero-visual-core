import type { Result } from '../core/result';
import type { DomainError } from '../errors/domain.errors';
import type { PatientInviteLink } from '../entities/patient-invite-link.entity';

/**
 * Puerto de vinculación Cuidador <-> Adulto Mayor por código de
 * invitación. Solo tiene implementación Supabase (no SQLite): vincular dos
 * cuentas que viven en dispositivos distintos es, por definición, un
 * concepto de servidor — no hay forma de tener sentido "offline-first" acá.
 */
export interface PairingRepository {
  /** Valida el código y crea el vínculo — `caregiverId` es quien está redimiendo (siempre el actor autenticado). */
  redeemInviteCode(inviteCode: string, caregiverId: string): Promise<Result<PatientInviteLink, DomainError>>;
  findLinkedPatientsByCaregiver(caregiverId: string): Promise<Result<readonly string[], DomainError>>;
}
