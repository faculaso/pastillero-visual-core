import { DoseStatus } from '../enums/dose.enums';
import { AdherenceLevel } from '../enums/adherence.enums';
import type { Dose } from '../entities/dose.entity';
import type { StockInfo } from '../entities/stock-info.entity';
import type { AdherenceMetrics } from '../entities/adherence-metrics.entity';
import { calculateDaysRemaining, calculateStockAlertLevel } from './stock.factory';

/**
 * Cálculo puro de métricas de adherencia (CU-03 pasos 1-3, RF-06). No
 * retorna `Result`: no hay invariante que pueda violarse dado un input bien
 * tipado — `doses` vacío es un caso válido (adherencia 100% por convención,
 * ya que no hubo ninguna toma incumplida).
 */
export function calculateAdherenceMetrics(
  treatmentId: string,
  periodStart: Date,
  periodEnd: Date,
  doses: readonly Dose[],
  stock: StockInfo,
): AdherenceMetrics {
  const totalScheduled = doses.length;
  const totalTaken = doses.filter((d) => d.status === DoseStatus.TAKEN).length;

  const adherencePercentage = totalScheduled === 0 ? 100 : (totalTaken / totalScheduled) * 100;

  return {
    treatmentId,
    periodStart,
    periodEnd,
    totalScheduled,
    totalTaken,
    adherencePercentage: Math.round(adherencePercentage * 100) / 100, // 2 decimales
    estimatedDaysRemaining: calculateDaysRemaining(stock),
    stockAlertLevel: calculateStockAlertLevel(stock),
  };
}

/** Umbral convencional de "tratamiento cumplido" en adherencia a la medicación. */
const GOOD_ADHERENCE_THRESHOLD = 80;
const PARTIAL_ADHERENCE_THRESHOLD = 50;

/**
 * Traduce el porcentaje a una lectura accionable. Vive en el dominio (no en
 * la pantalla) por el mismo motivo que `calculateStockAlertLevel`: si cada
 * vista decide su propio criterio, terminan discrepando — y acá discrepar
 * significa decirle a un cuidador que todo está bien cuando no lo está.
 */
export function calculateAdherenceLevel(adherencePercentage: number): AdherenceLevel {
  if (adherencePercentage >= GOOD_ADHERENCE_THRESHOLD) return AdherenceLevel.GOOD;
  if (adherencePercentage >= PARTIAL_ADHERENCE_THRESHOLD) return AdherenceLevel.PARTIAL;
  return AdherenceLevel.POOR;
}
