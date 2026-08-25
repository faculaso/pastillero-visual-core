import type { SupabaseClient } from '@supabase/supabase-js';
import { Ok, Err, type Result, DomainErrors, type DomainError } from '../../../../domain';
import type { PairingRepository, PatientInviteLink } from '../../../../domain';

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

  /** Ver `redeem_invite_code` en `supabase/migrations/0001_accounts_and_pairing.sql` — valida el código y crea el vínculo server-side (`security definer`). */
  async redeemInviteCode(inviteCode: string, caregiverId: string): Promise<Result<PatientInviteLink, DomainError>> {
    const { data, error } = await this.client.rpc('redeem_invite_code', { p_invite_code: inviteCode });
    if (error) {
      if (error.message.includes('INVITE_CODE_INVALID')) return Err(DomainErrors.inviteCodeInvalid(inviteCode));
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
}
