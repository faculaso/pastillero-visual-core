import { Ok, Err, type Result } from '../core/result';
import { DomainErrors, type DomainError } from '../errors/domain.errors';
import { MeasurementUnit } from '../enums/treatment.enums';
import { StockAlertLevel } from '../enums/stock.enums';
import type { StockInfo } from '../entities/stock-info.entity';

/** Umbral de WARNING por defecto; CRITICAL usa `criticalThresholdDays` del propio StockInfo. */
const DEFAULT_WARNING_THRESHOLD_DAYS = 7;

export interface CreateStockInfoInput {
  readonly currentQuantity: number;
  readonly dailyConsumption: number;
  readonly unit: MeasurementUnit;
  readonly criticalThresholdDays?: number; // default 3, según CU-03 paso 4
}

/** Invariantes: cantidades no negativas, umbral crítico >= 1 día. */
export function createStockInfo(input: CreateStockInfoInput): Result<StockInfo, DomainError> {
  const { currentQuantity, dailyConsumption, unit, criticalThresholdDays = 3 } = input;

  if (!Number.isFinite(currentQuantity) || currentQuantity < 0) {
    return Err(DomainErrors.invalidQuantity(currentQuantity));
  }
  if (!Number.isFinite(dailyConsumption) || dailyConsumption < 0) {
    return Err(DomainErrors.invalidQuantity(dailyConsumption));
  }
  if (!Number.isInteger(criticalThresholdDays) || criticalThresholdDays < 1) {
    return Err(DomainErrors.validation(`criticalThresholdDays inválido: ${criticalThresholdDays}`));
  }

  return Ok({ currentQuantity, dailyConsumption, unit, criticalThresholdDays });
}

/**
 * Decremento de stock (CU-02 paso 6, tras confirmar una toma).
 * Invariante: no permite stock negativo. `quantity` debe ser > 0.
 */
export function decrementStock(
  stock: StockInfo,
  quantity: number,
): Result<StockInfo, DomainError> {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return Err(DomainErrors.invalidQuantity(quantity));
  }
  if (stock.currentQuantity - quantity < 0) {
    // StockInfo es un VO embebido sin id propio; el treatmentId se agrega
    // como contexto en la capa de aplicación (que sí conoce el agregado).
    return Err(DomainErrors.insufficientStock('unknown'));
  }
  return Ok({ ...stock, currentQuantity: stock.currentQuantity - quantity });
}

/**
 * Ajuste manual de stock (CU-03 paso 5, "Actualizar Stock" tras la compra).
 * Invariante: la nueva cantidad no puede ser negativa.
 */
export function updateStockQuantity(
  stock: StockInfo,
  newQuantity: number,
): Result<StockInfo, DomainError> {
  if (!Number.isFinite(newQuantity) || newQuantity < 0) {
    return Err(DomainErrors.invalidQuantity(newQuantity));
  }
  return Ok({ ...stock, currentQuantity: newQuantity });
}

/**
 * Días restantes estimados = currentQuantity / dailyConsumption (CU-03 paso 3).
 * Si `dailyConsumption` es 0 (p. ej. tratamientos AS_NEEDED sin consumo fijo),
 * se considera stock indefinido y se retorna `Number.POSITIVE_INFINITY`
 * — decisión de dominio: no es un error, es "sin riesgo de agotamiento calculable".
 */
export function calculateDaysRemaining(stock: StockInfo): number {
  if (stock.dailyConsumption === 0) {
    return Number.POSITIVE_INFINITY;
  }
  return stock.currentQuantity / stock.dailyConsumption;
}

/**
 * Nivel de alerta derivado de días restantes (CU-03 paso 4: <= 3 días -> CRITICAL).
 * WARNING es un umbral de UX intermedio, fijo en 7 días salvo que
 * `criticalThresholdDays` ya sea >= 7 (en cuyo caso no tiene sentido un
 * escalón intermedio y se colapsa directo a CRITICAL).
 */
export function calculateStockAlertLevel(stock: StockInfo): StockAlertLevel {
  const daysRemaining = calculateDaysRemaining(stock);
  if (daysRemaining <= stock.criticalThresholdDays) {
    return StockAlertLevel.CRITICAL;
  }
  const warningThreshold = Math.max(DEFAULT_WARNING_THRESHOLD_DAYS, stock.criticalThresholdDays);
  if (daysRemaining <= warningThreshold) {
    return StockAlertLevel.WARNING;
  }
  return StockAlertLevel.NORMAL;
}
