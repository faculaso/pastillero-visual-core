export interface ExtendDoseHorizonInput {
  readonly patientId: string;
  /** Hasta cuántos días hacia adelante asegurar tomas. Default: el mismo horizonte que usa el alta. */
  readonly horizonDays?: number;
}

export interface ExtendDoseHorizonOutput {
  /** Cuántas tomas se crearon en esta pasada. Cero es el caso normal y esperado. */
  readonly createdCount: number;
  /** Tomas creadas cuya alarma del sistema no se pudo programar (best-effort, no revierte nada). */
  readonly alarmWarnings: readonly string[];
}
