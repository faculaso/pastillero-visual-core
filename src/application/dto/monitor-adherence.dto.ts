import type { AdherenceMetrics, StockInfo } from '../../domain';

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
  /**
   * De QUÉ tratamiento son estas métricas. `AdherenceMetrics` solo lleva
   * `treatmentId`, así que la pantalla no tenía forma de nombrarlo: se
   * titulaba "Adherencia y stock" a secas y se llegaba a ella desde una
   * lista donde dos tratamientos distintos pueden mostrar el mismo nombre
   * comercial. Abajo hay un formulario que cambia el stock — saber cuál se
   * está tocando no es un lujo.
   */
  readonly medicationName: string;
  /**
   * Stock actual completo (cantidad y unidad), no solo los días estimados
   * que ya trae `metrics`: el formulario de reposición pedía una "cantidad
   * nueva" sin decir de qué unidad ni cuánto había.
   */
  readonly stock: StockInfo;
  /** true si el nivel CRITICAL disparó una notificación de reposición (CU-03 paso 4). */
  readonly criticalAlertDispatched: boolean;
}
