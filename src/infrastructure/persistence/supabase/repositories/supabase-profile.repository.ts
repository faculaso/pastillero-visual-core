import type { SupabaseClient } from '@supabase/supabase-js';
import { Ok, Err, type Result, DomainErrors, type DomainError } from '../../../../domain';
import type { Profile, ProfileRepository, UserRole } from '../../../../domain';

interface ProfileRow {
  readonly id: string;
  readonly role: string;
  readonly display_name: string | null;
  readonly invite_code: string | null;
}

function mapRowToProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    role: row.role as UserRole,
    displayName: row.display_name,
    inviteCode: row.invite_code,
  };
}

export class SupabaseProfileRepository implements ProfileRepository {
  constructor(private readonly client: SupabaseClient) {}

  async findById(id: string): Promise<Result<Profile | null, DomainError>> {
    const { data, error } = await this.client.from('profiles').select('*').eq('id', id).maybeSingle();
    if (error) return Err(DomainErrors.repositoryFailure(error));
    return Ok(data ? mapRowToProfile(data as ProfileRow) : null);
  }
}
