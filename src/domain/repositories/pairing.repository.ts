import type { Result } from '../core/result';
import type { DomainError } from '../errors/domain.errors';
import type { PatientInviteLink, PatientInviteCode, LinkedCaregiver } from '../entities/patient-invite-link.entity';

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

  // --- Lado del Adulto Mayor: sus códigos y quiénes lo cuidan ---

  findInviteCodesByPatient(patientId: string): Promise<Result<readonly PatientInviteCode[], DomainError>>;
  findCaregiversByPatient(patientId: string): Promise<Result<readonly LinkedCaregiver[], DomainError>>;
  /** Genera un código nuevo. La base rechaza pasarse del tope de cuidadores. */
  createInviteCode(): Promise<Result<PatientInviteCode, DomainError>>;
  /** Da de baja un código TODAVÍA SIN USAR. Uno ya redimido no se revoca: eso es desvincular. */
  revokeInviteCode(codeId: string): Promise<Result<void, DomainError>>;
  /** Le saca el acceso a un Cuidador y libera su lugar. También mata el código con el que entró. */
  unlinkCaregiver(caregiverId: string): Promise<Result<void, DomainError>>;
}
