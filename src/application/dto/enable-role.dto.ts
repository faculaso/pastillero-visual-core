import type { Profile, UserRole } from '../../domain';

export interface EnableRoleInput {
  readonly userId: string;
  /** El rol que se quiere sumar. Si la cuenta ya lo tenía, la operación es idempotente. */
  readonly role: UserRole;
}

export interface EnableRoleOutput {
  readonly profile: Profile;
}
