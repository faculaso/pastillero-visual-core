import type { SupabaseClient } from '@supabase/supabase-js';
import { Ok, Err, type Result, DomainErrors, type DomainError } from '../../../../domain';
import {
  MAX_CAREGIVERS_PER_PATIENT,
  type PairingRepository,
  type PatientInviteLink,
  type PatientInviteCode,
  type LinkedCaregiver,
  type LinkedPatient,
} from '../../../../domain';

interface LinkRow {
  readonly caregiver_id: string;
  readonly patient_id: string;
  readonly linked_at: string;
}

interface CodeRow {
  readonly id: string;
  readonly code: string;
  readonly created_at: string;
  readonly redeemed_at: string | null;
  readonly redeemed_by: string | null;
}

function mapRowToLink(row: LinkRow): PatientInviteLink {
  return { caregiverId: row.caregiver_id, patientId: row.patient_id, linkedAt: new Date(row.linked_at) };
}

function mapRowToCode(row: CodeRow): PatientInviteCode {
  return {
    id: row.id,
    code: row.code,
    createdAt: new Date(row.created_at),
    redeemedAt: row.redeemed_at ? new Date(row.redeemed_at) : null,
    redeemedBy: row.redeemed_by,
  };
}

/**
 * Las RPC de Postgres mandan su error como texto, así que el mapeo es por
 * `includes`. Cada nombre de excepción sale de
 * `supabase/migrations/0011_codigos_de_vinculacion.sql`.
 */
function mapRpcError(message: string, inviteCode = ''): DomainError | null {
  if (message.includes('INVITE_CODE_ALREADY_USED')) return DomainErrors.inviteCodeAlreadyUsed();
  if (message.includes('INVITE_CODE_INVALID')) return DomainErrors.inviteCodeInvalid(inviteCode);
  if (message.includes('CANNOT_LINK_TO_SELF')) return DomainErrors.cannotLinkToSelf();
  if (message.includes('TOO_MANY_CAREGIVERS')) return DomainErrors.tooManyCaregivers(MAX_CAREGIVERS_PER_PATIENT);
  if (message.includes('INVITE_CODE_LIMIT_REACHED')) {
    return DomainErrors.inviteCodeLimitReached(MAX_CAREGIVERS_PER_PATIENT);
  }
  return null;
}

export class SupabasePairingRepository implements PairingRepository {
  constructor(private readonly client: SupabaseClient) {}

  /** Ver `redeem_invite_code` en `supabase/migrations/0011_codigos_de_vinculacion.sql` — valida el código, lo consume y crea el vínculo server-side (`security definer`). */
  async redeemInviteCode(inviteCode: string, caregiverId: string): Promise<Result<PatientInviteLink, DomainError>> {
    const { data, error } = await this.client.rpc('redeem_invite_code', { p_invite_code: inviteCode });
    if (error) return Err(mapRpcError(error.message, inviteCode) ?? DomainErrors.repositoryFailure(error));
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

  async findInviteCodesByPatient(patientId: string): Promise<Result<readonly PatientInviteCode[], DomainError>> {
    const { data, error } = await this.client
      .from('patient_invite_codes')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: true });
    if (error) return Err(DomainErrors.repositoryFailure(error));
    return Ok(((data ?? []) as CodeRow[]).map(mapRowToCode));
  }

  /**
   * Las dos puntas del vínculo, con nombre: quién cuida a un paciente, y a
   * quiénes cuida un cuidador. El nombre vive en `profiles`, no en el
   * vínculo; el join anidado de PostgREST lo trae en una sola consulta, y
   * quien habilita ver esa fila es la policy `profiles_select_own_or_linked`.
   *
   * El `!<columna>` no es decorativo: `caregiver_patient_links` tiene DOS
   * claves foráneas a `profiles` (cuidador y paciente), así que sin decir
   * cuál la consulta es ambigua y PostgREST la rechaza. Se desambigua por
   * nombre de COLUMNA, que es la forma documentada y no depende de cómo
   * Postgres haya bautizado la restricción.
   */
  async findCaregiversByPatient(patientId: string): Promise<Result<readonly LinkedCaregiver[], DomainError>> {
    const { data, error } = await this.client
      .from('caregiver_patient_links')
      .select('caregiver_id, linked_at, profiles!caregiver_id(display_name)')
      .eq('patient_id', patientId)
      .order('linked_at', { ascending: true });
    if (error) return Err(DomainErrors.repositoryFailure(error));

    interface CaregiverRow {
      readonly caregiver_id: string;
      readonly linked_at: string;
      readonly profiles: { readonly display_name: string | null } | null;
    }
    return Ok(
      ((data ?? []) as unknown as CaregiverRow[]).map((row) => ({
        caregiverId: row.caregiver_id,
        displayName: row.profiles?.display_name ?? null,
        linkedAt: new Date(row.linked_at),
      })),
    );
  }

  /** La otra punta del join de arriba: a quiénes cuida este Cuidador. */
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

  async createInviteCode(): Promise<Result<PatientInviteCode, DomainError>> {
    const { data, error } = await this.client.rpc('create_invite_code');
    if (error) return Err(mapRpcError(error.message) ?? DomainErrors.repositoryFailure(error));
    return Ok(mapRowToCode(data as CodeRow));
  }

  async revokeInviteCode(codeId: string): Promise<Result<void, DomainError>> {
    const { error } = await this.client.rpc('revoke_invite_code', { p_code_id: codeId });
    if (error) return Err(mapRpcError(error.message) ?? DomainErrors.repositoryFailure(error));
    return Ok(undefined);
  }

  async unlinkCaregiver(caregiverId: string): Promise<Result<void, DomainError>> {
    const { error } = await this.client.rpc('unlink_caregiver', { p_caregiver_id: caregiverId });
    if (error) return Err(mapRpcError(error.message) ?? DomainErrors.repositoryFailure(error));
    return Ok(undefined);
  }
}
