/**
 * Los dos roles de la app — quién usa cada cuenta. Vive en dominio porque
 * gobierna invariantes reales (quién puede registrar un tratamiento, quién
 * lo confirma), no solo una preferencia de UI.
 */
export type UserRole = 'ADULTO_MAYOR' | 'CUIDADOR';

/**
 * Proyección de la fila `profiles` (Supabase) — la cuenta real de un
 * usuario autenticado. `inviteCode` solo está presente para perfiles
 * ADULTO_MAYOR (ver trigger `set_invite_code` en
 * `supabase/migrations/0001_accounts_and_pairing.sql`); un CUIDADOR nunca
 * tiene código propio, solo redime el de su paciente vinculado.
 */
export interface Profile {
  readonly id: string;
  readonly role: UserRole;
  readonly displayName: string | null;
  readonly inviteCode: string | null;
}
