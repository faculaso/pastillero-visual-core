import { Ok, Err, type Result, DomainErrors, type DomainError } from '../../../../domain';
import type {
  Treatment,
  Medication,
  TreatmentStatus,
  PillShape,
  DosageFrequency,
  MeasurementUnit,
  TimeOfDay,
} from '../../../../domain';
import type { SQLiteRow } from '../sqlite-executor.port';

/** Fila cruda de `treatments` (tipado del resultado de la query). Uso interno del mapper. */
export interface TreatmentRow extends SQLiteRow {
  readonly id: string;
  readonly patient_id: string;
  readonly caregiver_id: string;
  readonly medication_id: string;
  readonly status: string;
  readonly visual_shape: string;
  readonly visual_color: string;
  readonly visual_secondary_color: string | null;
  readonly visual_pill_image_url: string | null;
  readonly visual_box_image_url: string | null;
  readonly visual_model3d_url: string | null;
  readonly visual_slot_label: string | null;
  readonly dosage_frequency: string;
  readonly dosage_times_of_day_json: string;
  readonly dosage_amount: number;
  readonly dosage_unit: string;
  readonly dosage_start_date: string;
  readonly dosage_end_date: string | null;
  readonly dosage_interval_days: number | null;
  readonly dosage_weekdays_json: string | null;
  readonly stock_current_quantity: number;
  readonly stock_daily_consumption: number;
  readonly stock_unit: string;
  readonly stock_critical_threshold_days: number;
  readonly created_at: string;
  readonly updated_at: string;
  // columnas de `medications` cuando el repo hace JOIN (ver SqliteTreatmentRepository)
  readonly medication_name: string;
  readonly medication_active_ingredient: string;
  readonly medication_laboratory: string;
  readonly medication_presentation: string;
  readonly medication_barcode: string | null;
}

function parseJsonArray<T>(json: string | null, fallback: T[]): Result<T[], DomainError> {
  if (json === null) return Ok(fallback);
  try {
    const parsed: unknown = JSON.parse(json);
    if (!Array.isArray(parsed)) {
      return Err(DomainErrors.repositoryFailure(new Error(`JSON no es array: ${json}`)));
    }
    return Ok(parsed as T[]);
  } catch (cause) {
    return Err(DomainErrors.repositoryFailure(cause));
  }
}

/** Fila -> entidad de dominio. Falla explícitamente ante corrupción de datos en vez de castear ciegamente. */
export function mapRowToTreatment(row: TreatmentRow): Result<Treatment, DomainError> {
  const timesOfDayResult = parseJsonArray<TimeOfDay>(row.dosage_times_of_day_json, []);
  if (!timesOfDayResult.ok) return timesOfDayResult;

  const weekdaysResult = parseJsonArray<number>(row.dosage_weekdays_json, []);
  if (!weekdaysResult.ok) return weekdaysResult;

  const medication: Medication = {
    id: row.medication_id,
    name: row.medication_name,
    activeIngredient: row.medication_active_ingredient,
    laboratory: row.medication_laboratory,
    presentation: row.medication_presentation,
    barcode: row.medication_barcode ?? undefined,
  };

  const treatment: Treatment = {
    id: row.id,
    patientId: row.patient_id,
    caregiverId: row.caregiver_id,
    medication,
    visualProfile: {
      shape: row.visual_shape as PillShape,
      color: row.visual_color,
      secondaryColor: row.visual_secondary_color ?? undefined,
      pillImageUrl: row.visual_pill_image_url ?? undefined,
      boxImageUrl: row.visual_box_image_url ?? undefined,
      model3dUrl: row.visual_model3d_url ?? undefined,
      slotLabel: row.visual_slot_label ?? undefined,
    },
    dosageScheme: {
      frequency: row.dosage_frequency as DosageFrequency,
      timesOfDay: timesOfDayResult.value,
      dosagePerTake: { amount: row.dosage_amount, unit: row.dosage_unit as MeasurementUnit },
      startDate: new Date(row.dosage_start_date),
      endDate: row.dosage_end_date ? new Date(row.dosage_end_date) : undefined,
      intervalDays: row.dosage_interval_days ?? undefined,
      weekdays: weekdaysResult.value.length > 0 ? weekdaysResult.value : undefined,
    },
    stock: {
      currentQuantity: row.stock_current_quantity,
      dailyConsumption: row.stock_daily_consumption,
      unit: row.stock_unit as MeasurementUnit,
      criticalThresholdDays: row.stock_critical_threshold_days,
    },
    status: row.status as TreatmentStatus,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };

  return Ok(treatment);
}

/** Entidad -> parámetros posicionales para INSERT/UPDATE de `treatments`. */
export function mapTreatmentToParams(t: Treatment): readonly unknown[] {
  return [
    t.id,
    t.patientId,
    t.caregiverId,
    t.medication.id,
    t.status,
    t.visualProfile.shape,
    t.visualProfile.color,
    t.visualProfile.secondaryColor ?? null,
    t.visualProfile.pillImageUrl ?? null,
    t.visualProfile.boxImageUrl ?? null,
    t.visualProfile.model3dUrl ?? null,
    t.visualProfile.slotLabel ?? null,
    t.dosageScheme.frequency,
    JSON.stringify(t.dosageScheme.timesOfDay),
    t.dosageScheme.dosagePerTake.amount,
    t.dosageScheme.dosagePerTake.unit,
    t.dosageScheme.startDate.toISOString(),
    t.dosageScheme.endDate?.toISOString() ?? null,
    t.dosageScheme.intervalDays ?? null,
    t.dosageScheme.weekdays ? JSON.stringify(t.dosageScheme.weekdays) : null,
    t.stock.currentQuantity,
    t.stock.dailyConsumption,
    t.stock.unit,
    t.stock.criticalThresholdDays,
    t.createdAt.toISOString(),
    t.updatedAt.toISOString(),
  ];
}
