export interface SyncDoseAlarmsInput {
  readonly patientId: string;
  /** Hasta cuántos días hacia adelante re-armar. Default: el mismo horizonte que materializa las tomas. */
  readonly horizonDays?: number;
}

export interface SyncDoseAlarmsOutput {
  /** Alarmas que faltaban y se programaron en esta pasada. Cero es el caso normal. */
  readonly scheduledCount: number;
  /** Alarmas que sobraban (toma ya confirmada, o tratamiento dado de baja desde otro teléfono) y se apagaron. */
  readonly cancelledCount: number;
  /** Tomas cuya alarma no se pudo tocar — best-effort, no revierte nada. */
  readonly alarmWarnings: readonly string[];
}
