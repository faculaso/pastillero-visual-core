import type { VisualProfile, Dosage } from '../../domain';

/** Vista enriquecida: Dose + los datos visuales/medicación que vienen del Treatment (join en la capa de aplicación). */
export interface PendingDoseView {
  readonly doseId: string;
  readonly treatmentId: string;
  readonly scheduledAt: Date;
  readonly medicationName: string;
  readonly visualProfile: VisualProfile;
  readonly dosagePerTake: Dosage;
}

export interface GetPendingDosesInput {
  readonly patientId: string;
  /** Default: hoy (ver Clock inyectado en el use case). */
  readonly date?: Date;
}

export interface GetPendingDosesOutput {
  readonly doses: readonly PendingDoseView[];
}
