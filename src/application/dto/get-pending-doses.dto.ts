import type { VisualProfile, Dosage } from '../../domain';

/** Vista enriquecida: Dose + los datos visuales/medicación que vienen del Treatment (join en la capa de aplicación). */
export interface PendingDoseView {
  readonly doseId: string;
  readonly treatmentId: string;
  readonly scheduledAt: Date;
  readonly medicationName: string;
  readonly visualProfile: VisualProfile;
  readonly dosagePerTake: Dosage;
  /**
   * Nombre de quien cargó este tratamiento. `null` cuando no se pudo
   * resolver: el Cuidador ya no está vinculado (la RLS deja de dejar ver su
   * perfil), nunca puso nombre, o la consulta falló. La pantalla omite la
   * línea en ese caso — nunca inventa un "Cuidador" genérico, que sería
   * peor que no decir nada.
   */
  readonly caregiverName: string | null;
}

export interface GetPendingDosesInput {
  readonly patientId: string;
  /** Default: hoy (ver Clock inyectado en el use case). */
  readonly date?: Date;
}

export interface GetPendingDosesOutput {
  readonly doses: readonly PendingDoseView[];
}
