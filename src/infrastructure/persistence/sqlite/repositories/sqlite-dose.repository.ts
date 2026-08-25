import { Ok, Err, type Result, DomainErrors, DomainError } from '../../../../domain';
import type { Dose, DoseRepository, Dosage, StockInfo, MeasurementUnit } from '../../../../domain';
import type { SqliteTransactionContext } from '../sqlite-transaction-context';
import type { SQLiteRow } from '../sqlite-executor.port';
import { mapRowToDose, mapDoseToParams, type DoseRow } from '../mappers/dose-medication.mapper';

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

export class SqliteDoseRepository implements DoseRepository {
  constructor(private readonly context: SqliteTransactionContext) {}

  async createSlots(doses: readonly Dose[]): Promise<Result<readonly Dose[], DomainError>> {
    try {
      const executor = this.context.getExecutor();
      // Insert secuencial dentro de la misma transacción del caller (no usa
      // `Promise.all`: la mayoría de los drivers SQLite serializan igual, y
      // secuencial deja logs de error más claros ante fallo de un slot puntual).
      for (const dose of doses) {
        await executor.execute(
          `INSERT INTO doses (id, treatment_id, scheduled_at, status, confirmed_at, quantity_taken_amount, quantity_taken_unit)
           VALUES (?,?,?,?,?,?,?)`,
          mapDoseToParams(dose),
        );
      }
      return Ok(doses);
    } catch (cause) {
      return Err(DomainErrors.repositoryFailure(cause));
    }
  }

  async findById(id: string): Promise<Result<Dose | null, DomainError>> {
    try {
      const row = await this.context
        .getExecutor()
        .queryOne<DoseRow>(`SELECT * FROM doses WHERE id = ?`, [id]);
      if (!row) return Ok(null);
      return mapRowToDose(row);
    } catch (cause) {
      return Err(DomainErrors.repositoryFailure(cause));
    }
  }

  async findPendingByPatientAndDate(
    patientId: string,
    date: Date,
  ): Promise<Result<readonly Dose[], DomainError>> {
    const { dayStart, dayEnd } = dayBounds(date);

    return this.queryMany(
      `SELECT d.* FROM doses d
       JOIN treatments t ON t.id = d.treatment_id
       WHERE t.patient_id = ?
         AND d.status = 'PENDING'
         AND d.scheduled_at BETWEEN ? AND ?
       ORDER BY d.scheduled_at ASC`,
      [patientId, dayStart.toISOString(), dayEnd.toISOString()],
    );
  }

  async findAllByPatientAndDate(
    patientId: string,
    date: Date,
  ): Promise<Result<readonly Dose[], DomainError>> {
    const { dayStart, dayEnd } = dayBounds(date);

    return this.queryMany(
      `SELECT d.* FROM doses d
       JOIN treatments t ON t.id = d.treatment_id
       WHERE t.patient_id = ?
         AND d.scheduled_at BETWEEN ? AND ?
       ORDER BY d.scheduled_at ASC`,
      [patientId, dayStart.toISOString(), dayEnd.toISOString()],
    );
  }

  async findByTreatmentInRange(
    treatmentId: string,
    from: Date,
    to: Date,
  ): Promise<Result<readonly Dose[], DomainError>> {
    return this.queryMany(
      `SELECT * FROM doses WHERE treatment_id = ? AND scheduled_at BETWEEN ? AND ? ORDER BY scheduled_at ASC`,
      [treatmentId, from.toISOString(), to.toISOString()],
    );
  }

  async findByPatientInRange(
    patientId: string,
    from: Date,
    to: Date,
  ): Promise<Result<readonly Dose[], DomainError>> {
    return this.queryMany(
      `SELECT d.* FROM doses d
       JOIN treatments t ON t.id = d.treatment_id
       WHERE t.patient_id = ?
         AND d.scheduled_at BETWEEN ? AND ?
       ORDER BY d.scheduled_at ASC`,
      [patientId, from.toISOString(), to.toISOString()],
    );
  }

  /**
   * UPDATE condicional (`WHERE status = 'PENDING'`): defensa en profundidad
   * ante doble-confirmación concurrente (p. ej. reintento de sync offline
   * disparando dos veces la misma acción). Si `rowsAffected === 0`, se
   * distingue "no existe" de "ya estaba confirmada" con un SELECT de apoyo
   * — el error correcto importa para la UX de CU-02.
   */
  async confirmDose(
    doseId: string,
    confirmedAt: Date,
    quantityTaken?: Dosage,
  ): Promise<Result<Dose, DomainError>> {
    try {
      const executor = this.context.getExecutor();
      const result = await executor.execute(
        `UPDATE doses SET status = 'TAKEN', confirmed_at = ?, quantity_taken_amount = ?, quantity_taken_unit = ?
         WHERE id = ? AND status = 'PENDING'`,
        [confirmedAt.toISOString(), quantityTaken?.amount ?? null, quantityTaken?.unit ?? null, doseId],
      );

      if (result.rowsAffected === 0) {
        const existing = await executor.queryOne<DoseRow>(`SELECT * FROM doses WHERE id = ?`, [doseId]);
        if (!existing) return Err(DomainErrors.doseNotFound(doseId));
        return Err(DomainErrors.doseAlreadyConfirmed(doseId));
      }

      const updated = await executor.queryOne<DoseRow>(`SELECT * FROM doses WHERE id = ?`, [doseId]);
      if (!updated) return Err(DomainErrors.doseNotFound(doseId)); // no debería ocurrir tras el UPDATE exitoso
      return mapRowToDose(updated);
    } catch (cause) {
      return Err(DomainErrors.repositoryFailure(cause));
    }
  }

  /**
   * Confirma la toma + decrementa el stock en una única transacción SQL
   * real. IMPORTANTE: cada guard (`status='PENDING'`,
   * `stock_current_quantity >= cantidad`) que falla acá TIRA el
   * `DomainError` correspondiente (no lo `return`s dentro del callback) —
   * `context.runInTransaction` solo hace ROLLBACK ante una excepción; un
   * `return Err(...)` normal se habría comiteado igual, dejando la toma
   * confirmada sin el stock descontado. El catch de abajo recupera ese
   * `DomainError` tal cual (`instanceof DomainError`) en vez de
   * enmascararlo como `repositoryFailure`.
   */
  async confirmDoseWithStockDecrement(
    doseId: string,
    confirmedAt: Date,
    quantityTaken: Dosage,
  ): Promise<Result<{ dose: Dose; stock: StockInfo }, DomainError>> {
    try {
      return await this.context.runInTransaction(async () => {
        const executor = this.context.getExecutor();

        const confirmResult = await executor.execute(
          `UPDATE doses SET status = 'TAKEN', confirmed_at = ?, quantity_taken_amount = ?, quantity_taken_unit = ?
           WHERE id = ? AND status = 'PENDING'`,
          [confirmedAt.toISOString(), quantityTaken.amount, quantityTaken.unit, doseId],
        );
        if (confirmResult.rowsAffected === 0) {
          const existing = await executor.queryOne<DoseRow>(`SELECT * FROM doses WHERE id = ?`, [doseId]);
          throw existing ? DomainErrors.doseAlreadyConfirmed(doseId) : DomainErrors.doseNotFound(doseId);
        }

        const updatedDoseRow = await executor.queryOne<DoseRow>(`SELECT * FROM doses WHERE id = ?`, [
          doseId,
        ]);
        if (!updatedDoseRow) throw DomainErrors.doseNotFound(doseId); // no debería ocurrir tras el UPDATE exitoso
        const doseResult = mapRowToDose(updatedDoseRow);
        if (!doseResult.ok) throw doseResult.error;
        const dose = doseResult.value;

        const stockResult = await executor.execute(
          `UPDATE treatments
           SET stock_current_quantity = stock_current_quantity - ?
           WHERE id = ? AND stock_current_quantity >= ?`,
          [quantityTaken.amount, dose.treatmentId, quantityTaken.amount],
        );
        if (stockResult.rowsAffected === 0) {
          const exists = await executor.queryOne<SQLiteRow>(`SELECT id FROM treatments WHERE id = ?`, [
            dose.treatmentId,
          ]);
          throw exists
            ? DomainErrors.insufficientStock(dose.treatmentId)
            : DomainErrors.treatmentNotFound(dose.treatmentId);
        }

        const stockRow = await executor.queryOne<StockRow>(
          `SELECT stock_current_quantity, stock_daily_consumption, stock_unit, stock_critical_threshold_days
           FROM treatments WHERE id = ?`,
          [dose.treatmentId],
        );
        if (!stockRow) throw DomainErrors.treatmentNotFound(dose.treatmentId);

        return Ok({ dose, stock: mapRowToStockInfo(stockRow) });
      });
    } catch (cause) {
      if (cause instanceof DomainError) return Err(cause);
      return Err(DomainErrors.repositoryFailure(cause));
    }
  }

  async markMissed(doseId: string): Promise<Result<Dose, DomainError>> {
    try {
      const executor = this.context.getExecutor();
      const result = await executor.execute(
        `UPDATE doses SET status = 'MISSED' WHERE id = ? AND status = 'PENDING'`,
        [doseId],
      );
      if (result.rowsAffected === 0) {
        const existing = await executor.queryOne<DoseRow>(`SELECT * FROM doses WHERE id = ?`, [doseId]);
        if (!existing) return Err(DomainErrors.doseNotFound(doseId));
        return Err(DomainErrors.invalidStatusTransition(existing.status, 'MISSED'));
      }
      const updated = await executor.queryOne<DoseRow>(`SELECT * FROM doses WHERE id = ?`, [doseId]);
      if (!updated) return Err(DomainErrors.doseNotFound(doseId));
      return mapRowToDose(updated);
    } catch (cause) {
      return Err(DomainErrors.repositoryFailure(cause));
    }
  }

  private async queryMany(
    sql: string,
    params: readonly unknown[],
  ): Promise<Result<readonly Dose[], DomainError>> {
    try {
      const rows = await this.context.getExecutor().queryAll<DoseRow>(sql, params);
      const doses: Dose[] = [];
      for (const row of rows) {
        const mapped = mapRowToDose(row);
        if (!mapped.ok) return mapped;
        doses.push(mapped.value);
      }
      return Ok(doses);
    } catch (cause) {
      return Err(DomainErrors.repositoryFailure(cause));
    }
  }
}

function dayBounds(date: Date): { dayStart: Date; dayEnd: Date } {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);
  return { dayStart, dayEnd };
}
