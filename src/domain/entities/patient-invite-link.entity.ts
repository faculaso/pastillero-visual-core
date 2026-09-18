/** Proyección de una fila `caregiver_patient_links` — el vínculo Cuidador <-> Adulto Mayor creado al redimir un código de invitación. */
export interface PatientInviteLink {
  readonly caregiverId: string;
  readonly patientId: string;
  readonly linkedAt: Date;
}

/**
 * Un código de invitación del Adulto Mayor. A diferencia del viejo
 * `profiles.invite_code` (uno solo, eterno, irrevocable), hay hasta tres y
 * **cada uno se consume al usarse**: `redeemedAt` no nulo significa que ya
 * hay un Cuidador atado a ese código y que el código no sirve para nadie
 * más. Ver `supabase/migrations/0011_codigos_de_vinculacion.sql`.
 */
export interface PatientInviteCode {
  readonly id: string;
  readonly code: string;
  readonly createdAt: Date;
  readonly redeemedAt: Date | null;
  readonly redeemedBy: string | null;
}

/** Un Cuidador que ya tiene acceso a la cuenta del Adulto Mayor, con nombre para poder reconocerlo. */
export interface LinkedCaregiver {
  readonly caregiverId: string;
  readonly displayName: string | null;
  readonly linkedAt: Date;
}

/** Tope de Cuidadores por Adulto Mayor. Espeja `max_caregivers_per_patient()` en la base, que es quien lo hace cumplir de verdad. */
export const MAX_CAREGIVERS_PER_PATIENT = 3;
