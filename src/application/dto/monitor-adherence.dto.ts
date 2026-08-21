import type { AdherenceMetrics } from '../../domain';

export interface MonitorAdherenceInput {
  readonly treatmentId: string;
  /** ACT-02: solo el cuidador dueño del tratamiento puede consultar sus métricas. */
  readonly requestingCaregiverId: string;
  /** Default: últimos 30 días hasta ahora (ver DEFAULT_MONITORING_PERIOD_DAYS en el use case). */
  readonly periodStart?: Date;
  readonly periodEnd?: Date;
}

export interface MonitorAdherenceOutput {
  readonly metrics: AdherenceMetrics;
  /** true si el nivel CRITICAL disparó una notificación de reposición (CU-03 paso 4). */
  readonly criticalAlertDispatched: boolean;
}
