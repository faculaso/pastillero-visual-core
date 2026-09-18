import type { SupabaseClient } from '@supabase/supabase-js';
import { Ok, Err, type Result, DomainErrors, type DomainError } from '../../../../domain';
import type { PairingRepository, PatientInviteLink, LinkedPatient } from '../../../../domain';

interface LinkRow {
  readonly caregiver_id: string;
  readonly patient_id: string;
  readonly linked_at: string;
}

function mapRowToLink(row: LinkRow): PatientInviteLink {
  return { caregiverId: row.caregiver_id, patientId: row.patient_id, linkedAt: new Date(row.linked_at) };
}

export class SupabasePairingRepository implements PairingRepository {
  constructor(private readonly client: SupabaseClient) {}

  /** Ver `redeem_invite_code` en `supabase/migrations/0010_una_cuenta_dos_roles.sql` — valida el código y crea el vínculo server-side (`security definer`). */
  async redeemInviteCode(inviteCode: string, caregiverId: string): Promise<Result<PatientInviteLink, DomainError>> {
    const { data, error } = await this.client.rpc('redeem_invite_code', { p_invite_code: inviteCode });
    if (error) {
      if (error.message.includes('INVITE_CODE_INVALID')) return Err(DomainErrors.inviteCodeInvalid(inviteCode));
      if (error.message.includes('CANNOT_LINK_TO_SELF')) return Err(DomainErrors.cannotLinkToSelf());
      return Err(DomainErrors.repositoryFailure(error));
    }
    return Ok(mapRowToLink({ ...(data as LinkRow), caregiver_id: caregiverId }));
  }

  async findLinkedPatientsByCaregiver(caregiverId: string): Promise<Result<readonly string[], DomainError>> {
    const { data, error } = await this.client
      .from('caregiver_patient_links')
      .select('patient_id')
      .eq('caregiver_id', caregiverId)
      .order('linked_at', { ascending: true });
    if (error) return Err(DomainErrors.repositoryFailure(error));
    return Ok(((data ?? []) as { patient_id: string }[]).map((row) => row.patient_id));
  }

  /**
   * El nombre del paciente vive en `profiles`, no en el vínculo: el join
   * anidado de PostgREST lo trae en una sola consulta, y la policy
   * `profiles_select_own_or_linked` es la que permite ver esa fila.
   *
   * El `!patient_id` no es decorativo: `caregiver_patient_links` tiene DOS
   * claves foráneas a `profiles` (cuidador y paciente), así que sin decir
   * cuál la consulta es ambigua y PostgREST la rechaza. Se desambigua por
   * nombre de COLUMNA, que es la forma documentada y no depende de cómo
   * Postgres haya bautizado la restricción.
   */
  async findPatientsByCaregiver(caregiverId: string): Promise<Result<readonly LinkedPatient[], DomainError>> {
    const { data, error } = await this.client
      .from('caregiver_patient_links')
      .select('patient_id, linked_at, profiles!patient_id(display_name)')
      .eq('caregiver_id', caregiverId)
      .order('linked_at', { ascending: true });
    if (error) return Err(DomainErrors.repositoryFailure(error));

    interface PatientRow {
      readonly patient_id: string;
      readonly linked_at: string;
      readonly profiles: { readonly display_name: string | null } | null;
    }
    return Ok(
      ((data ?? []) as unknown as PatientRow[]).map((row) => ({
        patientId: row.patient_id,
        displayName: row.profiles?.display_name ?? null,
        linkedAt: new Date(row.linked_at),
      })),
    );
  }
}
