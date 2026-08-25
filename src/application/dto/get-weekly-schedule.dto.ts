import type { VisualProfile, DoseStatus, StockAlertLevel } from '../../domain';

export interface WeekDoseView {
  readonly doseId: string;
  readonly treatmentId: string;
  readonly medicationName: string;
  readonly visualProfile: VisualProfile;
  readonly scheduledAt: Date;
  readonly status: DoseStatus;
}

export interface TreatmentStockSummary {
  readonly treatmentId: string;
  readonly medicationName: string;
  readonly stockAlertLevel: StockAlertLevel;
}

export interface GetWeeklyScheduleInput {
  readonly patientId: string;
  /** Domingo 00:00 de la semana a traer. Default: domingo de la semana de "ahora" (ver Clock inyectado). */
  readonly weekStart?: Date;
}

export interface GetWeeklyScheduleOutput {
  readonly weekStart: Date;
  readonly weekEnd: Date;
  readonly doses: readonly WeekDoseView[];
  /** Solo tratamientos con stock en WARNING o CRITICAL — vacío si ninguno necesita atención. */
  readonly treatmentsNeedingAttention: readonly TreatmentStockSummary[];
  /** Sobre las tomas de la semana con `scheduledAt` ya pasado — 100 si no hay ninguna todavía. */
  readonly adherencePercentage: number;
}
