export interface GetPausedTreatmentsInput {
  /** ACT-02: solo se listan los tratamientos de este cuidador. */
  readonly caregiverId: string;
  readonly patientId: string;
}

export interface PausedTreatmentView {
  readonly treatmentId: string;
  readonly medicationName: string;
}

export interface GetPausedTreatmentsOutput {
  readonly treatments: readonly PausedTreatmentView[];
}
