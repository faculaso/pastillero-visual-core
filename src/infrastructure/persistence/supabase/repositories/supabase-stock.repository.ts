import type { SupabaseClient } from '@supabase/supabase-js';
import { Ok, Err, type Result, DomainErrors, type DomainError } from '../../../../domain';
import type { StockInfo, StockRepository, Treatment, MeasurementUnit, MedicationCatalogRepository, Medication } from '../../../../domain';
import { mapRowToTreatment, fallbackMedication, type SupabaseTreatmentRow } from '../mappers/treatment.mapper';

interface StockRow {
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

export class SupabaseStockRepository implements StockRepository {
  constructor(
    private readonly client: SupabaseClient,
    private readonly medicationCatalog: MedicationCatalogRepository,
  ) {}

  async getStock(treatmentId: string): Promise<Result<StockInfo, DomainError>> {
    const { data, error } = await this.client
      .from('treatments')
      .select('stock_current_quantity, stock_daily_consumption, stock_unit, stock_critical_threshold_days')
      .eq('id', treatmentId)
      .maybeSingle();
    if (error) return Err(DomainErrors.repositoryFailure(error));
    if (!data) return Err(DomainErrors.treatmentNotFound(treatmentId));
    return Ok(mapRowToStockInfo(data as StockRow));
  }

  /**
   * A diferencia de `DoseRepository.confirmDoseWithStockDecrement` (que sí
   * necesita ser atómico junto con la confirmación de la toma), este método
   * ya no tiene ningún caller que dependa de atomicidad cross-tabla — queda
   * como UPDATE condicional simple, igual de seguro ante decrementos
   * concurrentes (`WHERE stock_current_quantity >= ?`) que la versión SQLite.
   */
  async decrement(treatmentId: string, quantity: number): Promise<Result<StockInfo, DomainError>> {
    const current = await this.getStock(treatmentId);
    if (!current.ok) return current;
    if (current.value.currentQuantity < quantity) return Err(DomainErrors.insufficientStock(treatmentId));

    const { data, error } = await this.client
      .from('treatments')
      .update({ stock_current_quantity: current.value.currentQuantity - quantity })
      .eq('id', treatmentId)
      .gte('stock_current_quantity', quantity)
      .select('stock_current_quantity, stock_daily_consumption, stock_unit, stock_critical_threshold_days')
      .maybeSingle();
    if (error) return Err(DomainErrors.repositoryFailure(error));
    if (!data) return Err(DomainErrors.insufficientStock(treatmentId));
    return Ok(mapRowToStockInfo(data as StockRow));
  }

  async updateStock(treatmentId: string, newQuantity: number): Promise<Result<StockInfo, DomainError>> {
    const { data, error } = await this.client
      .from('treatments')
      .update({ stock_current_quantity: newQuantity })
      .eq('id', treatmentId)
      .select('stock_current_quantity, stock_daily_consumption, stock_unit, stock_critical_threshold_days')
      .maybeSingle();
    if (error) return Err(DomainErrors.repositoryFailure(error));
    if (!data) return Err(DomainErrors.treatmentNotFound(treatmentId));
    return Ok(mapRowToStockInfo(data as StockRow));
  }

  /**
   * `(actual / consumo_diario) <= umbral` no es expresable como filtro
   * declarativo de PostgREST (no hay forma de dividir dos columnas en el
   * query builder) — se trae el universo acotado (tratamientos ACTIVE de
   * este cuidador, con consumo > 0) y se filtra en JS. Volumen esperado por
   * cuidador (decenas de tratamientos, no miles), así que no vale la pena
   * una función SQL extra solo para este filtro de lectura.
   */
  async findCriticalStockTreatments(
    caregiverId: string,
  ): Promise<Result<readonly Treatment[], DomainError>> {
    const { data, error } = await this.client
      .from('treatments')
      .select('*')
      .eq('caregiver_id', caregiverId)
      .eq('status', 'ACTIVE')
      .gt('stock_daily_consumption', 0);
    if (error) return Err(DomainErrors.repositoryFailure(error));

    const rows = (data ?? []) as SupabaseTreatmentRow[];
    const critical = rows.filter(
      (row) => row.stock_current_quantity / row.stock_daily_consumption <= row.stock_critical_threshold_days,
    );

    const treatments: Treatment[] = [];
    for (const row of critical) {
      treatments.push(mapRowToTreatment(row, await this.resolveMedication(row)));
    }
    return Ok(treatments);
  }

  private async resolveMedication(row: SupabaseTreatmentRow): Promise<Medication> {
    const result = await this.medicationCatalog.findById(row.medication_catalog_id);
    if (result.ok && result.value) return result.value;
    return fallbackMedication(row);
  }
}
