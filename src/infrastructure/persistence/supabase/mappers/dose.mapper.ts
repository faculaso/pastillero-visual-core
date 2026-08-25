import type { Dose, DoseStatus, MeasurementUnit } from '../../../../domain';

export interface SupabaseDoseRow {
  readonly id: string;
  readonly treatment_id: string;
  readonly scheduled_at: string;
  readonly status: string;
  readonly confirmed_at: string | null;
  readonly quantity_taken_amount: number | null;
  readonly quantity_taken_unit: string | null;
}

export function mapRowToDose(row: SupabaseDoseRow): Dose {
  return {
    id: row.id,
    treatmentId: row.treatment_id,
    scheduledAt: new Date(row.scheduled_at),
    status: row.status as DoseStatus,
    confirmedAt: row.confirmed_at ? new Date(row.confirmed_at) : undefined,
    quantityTaken:
      row.quantity_taken_amount !== null && row.quantity_taken_unit !== null
        ? { amount: row.quantity_taken_amount, unit: row.quantity_taken_unit as MeasurementUnit }
        : undefined,
  };
}

/** Payload para insert/RPC — sin `treatment_id`: cada caller lo agrega (la RPC de alta lo saca del tratamiento recién creado). */
export function mapDoseToPayload(d: Dose): Record<string, unknown> {
  return { id: d.id, scheduled_at: d.scheduledAt.toISOString() };
}
