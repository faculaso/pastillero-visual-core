import { Ok, Err, type Result, DomainErrors, DomainError } from '../../../../domain';
import type { Treatment, TreatmentRepository, Dose } from '../../../../domain';
import type { SqliteTransactionContext } from '../sqlite-transaction-context';
import { mapRowToTreatment, mapTreatmentToParams, type TreatmentRow } from '../mappers/treatment.mapper';
import { mapDoseToParams } from '../mappers/dose-medication.mapper';

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

export class SqliteTreatmentRepository implements TreatmentRepository {
  constructor(private readonly context: SqliteTransactionContext) {}

  async create(treatment: Treatment): Promise<Result<Treatment, DomainError>> {
    try {
      await this.context.getExecutor().execute(
        `INSERT INTO treatments (
           id, patient_id, caregiver_id, medication_id, status,
           visual_shape, visual_color, visual_secondary_color, visual_pill_image_url, visual_box_image_url,
           visual_model3d_url, visual_slot_label,
           dosage_frequency, dosage_times_of_day_json, dosage_amount, dosage_unit,
           dosage_start_date, dosage_end_date, dosage_interval_days, dosage_weekdays_json,
           stock_current_quantity, stock_daily_consumption, stock_unit, stock_critical_threshold_days,
           created_at, updated_at
         ) VALUES (?,?,?,?,?, ?,?,?,?,?,?,?, ?,?,?,?,?,?,?,?, ?,?,?,?, ?,?)`,
        mapTreatmentToParams(treatment),
      );
      return Ok(treatment);
    } catch (cause) {
      return Err(DomainErrors.repositoryFailure(cause));
    }
  }

  /**
   * INSERT del tratamiento + INSERT de cada slot de dosis dentro de la
   * MISMA transacción SQL real (`context.runInTransaction`) — si cualquier
   * INSERT falla, ninguno de los dos queda persistido. Reemplaza la
   * orquestación anterior a nivel de `RegisterTreatmentUseCase` vía
   * `TransactionRunner` + dos repos separados.
   */
  async createWithInitialDoses(
    treatment: Treatment,
    doses: readonly Dose[],
  ): Promise<Result<{ treatment: Treatment; generatedDoses: readonly Dose[] }, DomainError>> {
    try {
      return await this.context.runInTransaction(async () => {
        const executor = this.context.getExecutor();

        await executor.execute(
          `INSERT INTO treatments (
             id, patient_id, caregiver_id, medication_id, status,
             visual_shape, visual_color, visual_pill_image_url, visual_box_image_url,
             visual_model3d_url, visual_slot_label,
             dosage_frequency, dosage_times_of_day_json, dosage_amount, dosage_unit,
             dosage_start_date, dosage_end_date, dosage_interval_days, dosage_weekdays_json,
             stock_current_quantity, stock_daily_consumption, stock_unit, stock_critical_threshold_days,
             created_at, updated_at
           ) VALUES (?,?,?,?,?, ?,?,?,?,?,?, ?,?,?,?,?,?,?,?, ?,?,?,?, ?,?)`,
          mapTreatmentToParams(treatment),
        );

        // Insert secuencial (no `Promise.all`): misma razón que `SqliteDoseRepository.createSlots`
        // — deja logs de error más claros ante fallo de un slot puntual.
        for (const dose of doses) {
          await executor.execute(
            `INSERT INTO doses (id, treatment_id, scheduled_at, status, confirmed_at, quantity_taken_amount, quantity_taken_unit)
             VALUES (?,?,?,?,?,?,?)`,
            mapDoseToParams(dose),
          );
        }

        return Ok({ treatment, generatedDoses: doses });
      });
    } catch (cause) {
      if (cause instanceof DomainError) return Err(cause);
      return Err(DomainErrors.repositoryFailure(cause));
    }
  }

  async update(treatment: Treatment): Promise<Result<Treatment, DomainError>> {
    try {
      const result = await this.context.getExecutor().execute(
        `UPDATE treatments SET
           status = ?,
           visual_shape = ?, visual_color = ?, visual_secondary_color = ?, visual_pill_image_url = ?, visual_box_image_url = ?,
           visual_model3d_url = ?, visual_slot_label = ?,
           dosage_frequency = ?, dosage_times_of_day_json = ?, dosage_amount = ?, dosage_unit = ?,
           dosage_start_date = ?, dosage_end_date = ?, dosage_interval_days = ?, dosage_weekdays_json = ?,
           stock_current_quantity = ?, stock_daily_consumption = ?, stock_unit = ?, stock_critical_threshold_days = ?,
           updated_at = ?
         WHERE id = ?`,
        [
          treatment.status,
          treatment.visualProfile.shape,
          treatment.visualProfile.color,
          treatment.visualProfile.secondaryColor ?? null,
          treatment.visualProfile.pillImageUrl ?? null,
          treatment.visualProfile.boxImageUrl ?? null,
          treatment.visualProfile.model3dUrl ?? null,
          treatment.visualProfile.slotLabel ?? null,
          treatment.dosageScheme.frequency,
          JSON.stringify(treatment.dosageScheme.timesOfDay),
          treatment.dosageScheme.dosagePerTake.amount,
          treatment.dosageScheme.dosagePerTake.unit,
          treatment.dosageScheme.startDate.toISOString(),
          treatment.dosageScheme.endDate?.toISOString() ?? null,
          treatment.dosageScheme.intervalDays ?? null,
          treatment.dosageScheme.weekdays ? JSON.stringify(treatment.dosageScheme.weekdays) : null,
          treatment.stock.currentQuantity,
          treatment.stock.dailyConsumption,
          treatment.stock.unit,
          treatment.stock.criticalThresholdDays,
          treatment.updatedAt.toISOString(),
          treatment.id,
        ],
      );
      if (result.rowsAffected === 0) return Err(DomainErrors.treatmentNotFound(treatment.id));
      return Ok(treatment);
    } catch (cause) {
      return Err(DomainErrors.repositoryFailure(cause));
    }
  }

  async findById(id: string): Promise<Result<Treatment | null, DomainError>> {
    try {
      const row = await this.context
        .getExecutor()
        .queryOne<TreatmentRow>(`${SELECT_WITH_MEDICATION} WHERE t.id = ?`, [id]);
      if (!row) return Ok(null);
      const mapped = mapRowToTreatment(row);
      if (!mapped.ok) return mapped;
      return Ok(mapped.value);
    } catch (cause) {
      return Err(DomainErrors.repositoryFailure(cause));
    }
  }

  async findActiveByPatient(patientId: string): Promise<Result<readonly Treatment[], DomainError>> {
    return this.queryMany(`${SELECT_WITH_MEDICATION} WHERE t.patient_id = ? AND t.status = 'ACTIVE'`, [
      patientId,
    ]);
  }

  async findAllByCaregiver(caregiverId: string): Promise<Result<readonly Treatment[], DomainError>> {
    return this.queryMany(`${SELECT_WITH_MEDICATION} WHERE t.caregiver_id = ?`, [caregiverId]);
  }

  async delete(id: string): Promise<Result<void, DomainError>> {
    try {
      await this.context.getExecutor().execute(`DELETE FROM treatments WHERE id = ?`, [id]);
      return Ok(undefined);
    } catch (cause) {
      return Err(DomainErrors.repositoryFailure(cause));
    }
  }

  private async queryMany(
    sql: string,
    params: readonly unknown[],
  ): Promise<Result<readonly Treatment[], DomainError>> {
    try {
      const rows = await this.context.getExecutor().queryAll<TreatmentRow>(sql, params);
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
