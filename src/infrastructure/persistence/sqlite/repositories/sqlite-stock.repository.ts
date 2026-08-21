import { Ok, Err, type Result, DomainErrors, type DomainError } from '../../../../domain';
import type { StockInfo, StockRepository, Treatment, MeasurementUnit } from '../../../../domain';
import type { SqliteTransactionContext } from '../sqlite-transaction-context';
import type { SQLiteRow } from '../sqlite-executor.port';
import { mapRowToTreatment, type TreatmentRow } from '../mappers/treatment.mapper';

interface StockRow extends SQLiteRow {
  readonly stock_current_quantity: number;
  readonly stock_daily_consumption: number;
  readonly stock_unit: string;
  readonly stock_critical_threshold_days: number;
}

function mapRowToStockInfo(row: StockRow): StockInfo {
  return {
    currentQuantity: row.stock_current_quantity,
    dailyConsumption: row.stock_daily_consumption,
    unit: row.stock_unit as MeasurementUnit,
    criticalThresholdDays: row.stock_critical_threshold_days,
  };
}

const SELECT_WITH_MEDICATION = `
  SELECT
    t.*,
    m.name              AS medication_name,
    m.active_ingredient AS medication_active_ingredient,
    m.laboratory        AS medication_laboratory,
    m.presentation       AS medication_presentation,
    m.barcode            AS medication_barcode
  FROM treatments t
  JOIN medications m ON m.id = t.medication_id
`;

export class SqliteStockRepository implements StockRepository {
  constructor(private readonly context: SqliteTransactionContext) {}

  async getStock(treatmentId: string): Promise<Result<StockInfo, DomainError>> {
    try {
      const row = await this.context.getExecutor().queryOne<StockRow>(
        `SELECT stock_current_quantity, stock_daily_consumption, stock_unit, stock_critical_threshold_days
         FROM treatments WHERE id = ?`,
        [treatmentId],
      );
      if (!row) return Err(DomainErrors.treatmentNotFound(treatmentId));
      return Ok(mapRowToStockInfo(row));
    } catch (cause) {
      return Err(DomainErrors.repositoryFailure(cause));
    }
  }

  /**
   * Decremento atómico vía `UPDATE ... WHERE stock_current_quantity >= ?`:
   * el propio motor SQLite garantiza que dos decrementos concurrentes nunca
   * dejen el stock negativo, incluso si ambos pasaron la validación de
   * dominio contra una lectura ligeramente stale (defensa en profundidad,
   * complementaria a `decrementStock` del dominio, no un reemplazo).
   */
  async decrement(treatmentId: string, quantity: number): Promise<Result<StockInfo, DomainError>> {
    try {
      const executor = this.context.getExecutor();
      const result = await executor.execute(
        `UPDATE treatments
         SET stock_current_quantity = stock_current_quantity - ?
         WHERE id = ? AND stock_current_quantity >= ?`,
        [quantity, treatmentId, quantity],
      );

      if (result.rowsAffected === 0) {
        const exists = await executor.queryOne<SQLiteRow>(`SELECT id FROM treatments WHERE id = ?`, [
          treatmentId,
        ]);
        if (!exists) return Err(DomainErrors.treatmentNotFound(treatmentId));
        return Err(DomainErrors.insufficientStock(treatmentId));
      }

      return this.getStock(treatmentId);
    } catch (cause) {
      return Err(DomainErrors.repositoryFailure(cause));
    }
  }

  async updateStock(treatmentId: string, newQuantity: number): Promise<Result<StockInfo, DomainError>> {
    try {
      const result = await this.context
        .getExecutor()
        .execute(`UPDATE treatments SET stock_current_quantity = ? WHERE id = ?`, [
          newQuantity,
          treatmentId,
        ]);
      if (result.rowsAffected === 0) return Err(DomainErrors.treatmentNotFound(treatmentId));
      return this.getStock(treatmentId);
    } catch (cause) {
      return Err(DomainErrors.repositoryFailure(cause));
    }
  }

  /**
   * CRITICAL cuando días_restantes <= umbral (CU-03 paso 4). Se filtra con
   * `daily_consumption > 0` para no dividir por cero en SQL, excluyendo esos
   * tratamientos del listado — consistente con el dominio (consumo 0 =
   * sin riesgo de agotamiento calculable, ver `calculateDaysRemaining`).
   */
  async findCriticalStockTreatments(
    caregiverId: string,
  ): Promise<Result<readonly Treatment[], DomainError>> {
    try {
      const rows = await this.context.getExecutor().queryAll<TreatmentRow>(
        `${SELECT_WITH_MEDICATION}
         WHERE t.caregiver_id = ?
           AND t.status = 'ACTIVE'
           AND t.stock_daily_consumption > 0
           AND (t.stock_current_quantity / t.stock_daily_consumption) <= t.stock_critical_threshold_days`,
        [caregiverId],
      );
      const treatments: Treatment[] = [];
      for (const row of rows) {
        const mapped = mapRowToTreatment(row);
        if (!mapped.ok) return mapped;
        treatments.push(mapped.value);
      }
      return Ok(treatments);
    } catch (cause) {
      return Err(DomainErrors.repositoryFailure(cause));
    }
  }
}
