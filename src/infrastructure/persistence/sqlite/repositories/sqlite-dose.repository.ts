import { Ok, Err, type Result, DomainErrors, type DomainError } from '../../../../domain';
import type { Dose, DoseRepository, Dosage } from '../../../../domain';
import type { SqliteTransactionContext } from '../sqlite-transaction-context';
import { mapRowToDose, mapDoseToParams, type DoseRow } from '../mappers/dose-medication.mapper';

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
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

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
