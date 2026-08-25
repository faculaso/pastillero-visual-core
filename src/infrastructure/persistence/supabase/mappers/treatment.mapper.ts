import type {
  Treatment,
  Medication,
  TreatmentStatus,
  PillShape,
  DosageFrequency,
  MeasurementUnit,
  TimeOfDay,
} from '../../../../domain';

/** Fila cruda de `treatments` en Postgres (columnas jsonb ya vienen parseadas como array/objeto, no como texto). */
export interface SupabaseTreatmentRow {
  readonly id: string;
  readonly patient_id: string;
  readonly caregiver_id: string;
  readonly medication_catalog_id: string;
  readonly medication_name: string;
  readonly status: string;
  readonly visual_shape: string;
  readonly visual_color: string;
  readonly visual_secondary_color: string | null;
  readonly visual_pill_image_url: string | null;
  readonly visual_box_image_url: string | null;
  readonly visual_model3d_url: string | null;
  readonly visual_slot_label: string | null;
  readonly dosage_frequency: string;
  readonly dosage_times_of_day: readonly TimeOfDay[];
  readonly dosage_amount: number;
  readonly dosage_unit: string;
  readonly dosage_start_date: string;
  readonly dosage_end_date: string | null;
  readonly dosage_interval_days: number | null;
  readonly dosage_weekdays: readonly number[] | null;
  readonly stock_current_quantity: number;
  readonly stock_daily_consumption: number;
  readonly stock_unit: string;
  readonly stock_critical_threshold_days: number;
  readonly created_at: string;
  readonly updated_at: string;
}

/**
 * `medication` se pasa ya resuelto (no viene de esta fila): el catálogo
 * ANMAT NO vive en Supabase (solo local en cada dispositivo), así que la
 * fila de Postgres solo trae un snapshot (`medication_catalog_id` +
 * `medication_name`) — el repositorio concreto es quien decide cómo
 * completar el resto (buscar en el catálogo local, o el fallback de acá
 * abajo si no lo encuentra).
 */
export function mapRowToTreatment(row: SupabaseTreatmentRow, medication: Medication): Treatment {
  return {
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
      timesOfDay: row.dosage_times_of_day,
      dosagePerTake: { amount: row.dosage_amount, unit: row.dosage_unit as MeasurementUnit },
      startDate: new Date(row.dosage_start_date),
      endDate: row.dosage_end_date ? new Date(row.dosage_end_date) : undefined,
      intervalDays: row.dosage_interval_days ?? undefined,
      weekdays: row.dosage_weekdays && row.dosage_weekdays.length > 0 ? row.dosage_weekdays : undefined,
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
}

/**
 * Placeholder mínimo cuando el catálogo local no tiene (todavía, o nunca)
 * el medicamento — p. ej. el dispositivo del Cuidador quedó con un catálogo
 * desactualizado respecto al que tenía el dispositivo que registró el
 * tratamiento. Nunca debe bloquear el mapeo de un tratamiento real.
 */
export function fallbackMedication(row: SupabaseTreatmentRow): Medication {
  return {
    id: row.medication_catalog_id,
    name: row.medication_name,
    activeIngredient: '',
    laboratory: '',
    presentation: '',
  };
}

/** Entidad -> payload para insert/RPC. Usa nombres de columna Postgres (snake_case). No incluye `id`: cada caller lo agrega según haga falta. */
export function mapTreatmentToPayload(t: Treatment): Record<string, unknown> {
  return {
    patient_id: t.patientId,
    caregiver_id: t.caregiverId,
    medication_catalog_id: t.medication.id,
    medication_name: t.medication.name,
    status: t.status,
    visual_shape: t.visualProfile.shape,
    visual_color: t.visualProfile.color,
    visual_secondary_color: t.visualProfile.secondaryColor ?? null,
    visual_pill_image_url: t.visualProfile.pillImageUrl ?? null,
    visual_box_image_url: t.visualProfile.boxImageUrl ?? null,
    visual_model3d_url: t.visualProfile.model3dUrl ?? null,
    visual_slot_label: t.visualProfile.slotLabel ?? null,
    dosage_frequency: t.dosageScheme.frequency,
    dosage_times_of_day: t.dosageScheme.timesOfDay,
    dosage_amount: t.dosageScheme.dosagePerTake.amount,
    dosage_unit: t.dosageScheme.dosagePerTake.unit,
    dosage_start_date: t.dosageScheme.startDate.toISOString().slice(0, 10),
    dosage_end_date: t.dosageScheme.endDate ? t.dosageScheme.endDate.toISOString().slice(0, 10) : null,
    dosage_interval_days: t.dosageScheme.intervalDays ?? null,
    dosage_weekdays: t.dosageScheme.weekdays ?? null,
    stock_current_quantity: t.stock.currentQuantity,
    stock_daily_consumption: t.stock.dailyConsumption,
    stock_unit: t.stock.unit,
    stock_critical_threshold_days: t.stock.criticalThresholdDays,
  };
}
