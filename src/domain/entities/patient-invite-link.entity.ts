/** Proyección de una fila `caregiver_patient_links` — el vínculo Cuidador <-> Adulto Mayor creado al redimir un código de invitación. */
export interface PatientInviteLink {
  readonly caregiverId: string;
  readonly patientId: string;
  readonly linkedAt: Date;
}
