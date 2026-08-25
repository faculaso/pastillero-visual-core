import type { PatientInviteLink } from '../../domain';

export interface RedeemInviteCodeInput {
  readonly caregiverId: string;
  readonly inviteCode: string;
}

export interface RedeemInviteCodeOutput {
  readonly link: PatientInviteLink;
}
