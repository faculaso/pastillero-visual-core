import type { SupabaseClient } from '@supabase/supabase-js';
import { Ok, Err, type Result, DomainErrors, type DomainError } from '../../../../domain';
import type { Profile, ProfileRepository, UserRole } from '../../../../domain';

interface ProfileRow {
  readonly id: string;
  readonly role: string;
  readonly display_name: string | null;
  readonly invite_code: string | null;
  // Opcionales: un respaldo offline guardado por una versión anterior a la
  // migración 0010 no los tiene. Ver el fallback en `mapRowToProfile`.
  readonly is_patient?: boolean | null;
  readonly is_caregiver?: boolean | null;
}

function mapRowToProfile(row: ProfileRow): Profile {
  const role = row.role as UserRole;
  return {
    id: row.id,
    role,
    displayName: row.display_name,
    inviteCode: row.invite_code,
    isPatient: row.is_patient ?? role === 'ADULTO_MAYOR',
    isCaregiver: row.is_caregiver ?? role === 'CUIDADOR',
  };
}

export class SupabaseProfileRepository implements ProfileRepository {
  constructor(private readonly client: SupabaseClient) {}

  async findById(id: string): Promise<Result<Profile | null, DomainError>> {
    const { data, error } = await this.client.from('profiles').select('*').eq('id', id).maybeSingle();
    if (error) return Err(DomainErrors.repositoryFailure(error));
    return Ok(data ? mapRowToProfile(data as ProfileRow) : null);
  }

  /**
   * La RLS (`profiles_update_own`) ya limita el UPDATE a la propia fila, así
   * que no hace falta una RPC `security definer`: el `.eq('id', userId)` es
   * por claridad, el candado real está en la base.
   *
   * Prender `is_patient` dispara el trigger `set_invite_code`, que le genera
   * el código de invitación en ese mismo UPDATE — por eso se relee la fila
   * completa con `select()`.
   */
  async enableRole(userId: string, role: UserRole): Promise<Result<Profile, DomainError>> {
    const columna = role === 'ADULTO_MAYOR' ? 'is_patient' : 'is_caregiver';
    const { data, error } = await this.client
      .from('profiles')
      .update({ [columna]: true })
      .eq('id', userId)
      .select('*')
      .maybeSingle();
    if (error) return Err(DomainErrors.repositoryFailure(error));
    if (!data) return Err(DomainErrors.repositoryFailure(new Error('No se pudo activar el rol.')));
    return Ok(mapRowToProfile(data as ProfileRow));
  }
}
