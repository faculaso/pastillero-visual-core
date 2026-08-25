export interface GetLinkedPatientInput {
  readonly caregiverId: string;
}

export interface GetLinkedPatientOutput {
  /** `null` si el cuidador todavía no vinculó ningún paciente. Ver nota de alcance sobre "un solo paciente por ahora" en `SessionContext`. */
  readonly patientId: string | null;
}
