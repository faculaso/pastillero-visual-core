import type { Profile } from '../../domain';

export interface GetProfileInput {
  readonly userId: string;
}

export interface GetProfileOutput {
  readonly profile: Profile | null;
}
