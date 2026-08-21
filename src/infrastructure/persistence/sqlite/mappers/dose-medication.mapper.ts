import { Ok, type Result, type DomainError } from '../../../../domain';
import type { Dose, DoseStatus, Medication, MeasurementUnit } from '../../../../domain';
import type { SQLiteRow } from '../sqlite-executor.port';

export interface DoseRow extends SQLiteRow {
  readonly id: string;
  readonly treatment_id: string;
  readonly scheduled_at: string;
  readonly status: string;
  readonly confirmed_at: string | null;
  readonly quantity_taken_amount: number | null;
  readonly quantity_taken_unit: string | null;
}

export function mapRowToDose(row: DoseRow): Result<Dose, DomainError> {
  const dose: Dose = {
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
  return Ok(dose);
}

export function mapDoseToParams(d: Dose): readonly unknown[] {
  return [
    d.id,
    d.treatmentId,
    d.scheduledAt.toISOString(),
    d.status,
    d.confirmedAt?.toISOString() ?? null,
    d.quantityTaken?.amount ?? null,
    d.quantityTaken?.unit ?? null,
  ];
}

export interface MedicationRow extends SQLiteRow {
  readonly id: string;
  readonly name: string;
  readonly active_ingredient: string;
  readonly laboratory: string;
  readonly presentation: string;
  readonly barcode: string | null;
}

export function mapRowToMedication(row: MedicationRow): Medication {
  return {
    id: row.id,
    name: row.name,
    activeIngredient: row.active_ingredient,
    laboratory: row.laboratory,
    presentation: row.presentation,
    barcode: row.barcode ?? undefined,
  };
}
