export interface SyncDoseAlarmsInput {
  readonly patientId: string;
  /** Hasta cuántos días hacia adelante re-armar. Default: el mismo horizonte que materializa las tomas. */
  readonly horizonDays?: number;
}

export interface SyncDoseAlarmsOutput {
  /** Alarmas que faltaban y se programaron en esta pasada. Cero es el caso normal. */
  readonly scheduledCount: number;
  /** Alarmas que sobraban y se apagaron: toma ya confirmada, tratamiento dado de baja desde otro teléfono, o basura de otro paciente que dejó la versión vieja. */
  readonly cancelledCount: number;
  /** Tomas cuya alarma no se pudo tocar — best-effort, no revierte nada. */
  readonly alarmWarnings: readonly string[];
}
