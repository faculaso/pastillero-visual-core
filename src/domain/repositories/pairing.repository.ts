import type { Result } from '../core/result';
import type { DomainError } from '../errors/domain.errors';
import type { PatientInviteLink, LinkedPatient } from '../entities/patient-invite-link.entity';

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
  /** Igual que la de arriba pero con nombre: es lo que necesita el Cuidador para elegir a cuál de sus pacientes entra. */
  findPatientsByCaregiver(caregiverId: string): Promise<Result<readonly LinkedPatient[], DomainError>>;
}
