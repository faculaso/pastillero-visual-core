import type { LinkedCaregiver, PatientInviteCode } from '../../domain';

export interface GetPairingOverviewInput {
  readonly patientId: string;
}

/** Todo lo que la pantalla "Mis códigos" del Adulto Mayor necesita para pintarse de una sola vez. */
export interface GetPairingOverviewOutput {
  /** Quiénes ya tienen acceso, con nombre, más viejo primero. */
  readonly caregivers: readonly LinkedCaregiver[];
  /** Códigos entregados que nadie usó todavía — los únicos que se pueden dar de baja. */
  readonly pendingCodes: readonly PatientInviteCode[];
  /** Cuántos códigos más se pueden generar. 0 = no hay lugar hasta liberar uno. */
  readonly slotsLeft: number;
  readonly maxCaregivers: number;
}

export interface CreateInviteCodeOutput {
  readonly code: PatientInviteCode;
}

export interface RevokeInviteCodeInput {
  readonly codeId: string;
}

export interface UnlinkCaregiverInput {
  readonly caregiverId: string;
}
