import { StockAlertLevel } from '../enums/stock.enums';

/**
 * AdherenceMetrics: VO de solo-lectura, computado (no persistido como
 * entidad independiente). Resultado del cálculo de CU-03 pasos 2-4.
 */
export interface AdherenceMetrics {
  readonly treatmentId: string;
  readonly periodStart: Date;
  readonly periodEnd: Date;
  readonly totalScheduled: number;
  readonly totalTaken: number;
  readonly adherencePercentage: number; // 0-100
  readonly estimatedDaysRemaining: number; // Stock Actual / Consumo Diario
  readonly stockAlertLevel: StockAlertLevel;
}
