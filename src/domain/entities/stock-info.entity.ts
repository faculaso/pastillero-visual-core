import { MeasurementUnit } from '../enums/treatment.enums';

/**
 * StockInfo: inventario local del tratamiento (CU-02 paso 6, CU-03).
 * `criticalThresholdDays` es configurable por tratamiento (default 3, según
 * CU-03 paso 4) para permitir ajustar el umbral en fármacos de reposición lenta.
 */
export interface StockInfo {
  readonly currentQuantity: number;
  readonly dailyConsumption: number; // derivado del DosageScheme, cacheado para performance
  readonly unit: MeasurementUnit;
  readonly criticalThresholdDays: number;
}
