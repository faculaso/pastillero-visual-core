export interface ClearPatientDoseAlarmsInput {
  /** Los pacientes que este dispositivo SUPERVISA — nunca su propio dueño. */
  readonly patientIds: readonly string[];
  /** Hasta cuántos días hacia adelante mirar. Default: el mismo horizonte que materializa las tomas. */
  readonly horizonDays?: number;
}

export interface ClearPatientDoseAlarmsOutput {
  /** Alarmas ajenas que se apagaron. Cero es el caso normal a partir de la segunda pasada. */
  readonly cancelledCount: number;
  /** Tomas cuya alarma no se pudo apagar — best-effort, no revierte nada. */
  readonly alarmWarnings: readonly string[];
}
