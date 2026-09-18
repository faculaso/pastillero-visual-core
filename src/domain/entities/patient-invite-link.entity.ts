/** Proyección de una fila `caregiver_patient_links` — el vínculo Cuidador <-> Adulto Mayor creado al redimir un código de invitación. */
export interface PatientInviteLink {
  readonly caregiverId: string;
  readonly patientId: string;
  readonly linkedAt: Date;
}

/** Un Adulto Mayor al que este Cuidador ya tiene acceso, con nombre para poder distinguirlo de los demás. */
export interface LinkedPatient {
  readonly patientId: string;
  readonly displayName: string | null;
  readonly linkedAt: Date;
}
