/**
 * Nivel de alerta derivado de `daysRemaining` (Stock Actual / Consumo Diario).
 * CU-03 paso 4: <= 3 días -> notificación crítica. Se agrega WARNING como
 * umbral intermedio de UX para no saltar directo de NORMAL a CRITICAL.
 */
export enum StockAlertLevel {
  NORMAL = 'NORMAL',
  WARNING = 'WARNING', // <= 7 días
  CRITICAL = 'CRITICAL', // <= 3 días (umbral del CU-03)
}
