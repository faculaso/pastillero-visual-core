import type { LinkedPatient } from '../../domain';

export interface GetLinkedPatientsInput {
  readonly caregiverId: string;
}

export interface GetLinkedPatientsOutput {
  /** Vacío si el Cuidador todavía no vinculó a nadie — no es un error, es el estado inicial de toda cuenta nueva. */
  readonly patients: readonly LinkedPatient[];
}
