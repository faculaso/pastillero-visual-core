import type { SupabaseClient } from '@supabase/supabase-js';
import { Ok, Err, type Result, DomainErrors, type DomainError } from '../../../../domain';
import type { Dose, DoseRepository, Dosage, StockInfo, MeasurementUnit } from '../../../../domain';
import { mapRowToDose, mapDoseToPayload, type SupabaseDoseRow } from '../mappers/dose.mapper';

interface DosesWithPatientRow extends SupabaseDoseRow {
  readonly patient_id: string;
  readonly caregiver_id: string;
}

interface RpcStockRow {
  readonly stock_current_quantity: number;
  readonly stock_daily_consumption: number;
  readonly stock_unit: string;
  readonly stock_critical_threshold_days: number;
}

function dayBounds(date: Date): { dayStart: Date; dayEnd: Date } {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);
  return { dayStart, dayEnd };
}

/** Traduce el mensaje de un `raise exception` de la RPC `confirm_dose_atomic` al `DomainError` equivalente al de la versión SQLite. */
function mapConfirmRpcError(message: string, doseId: string): DomainError {
  if (message.includes('DOSE_NOT_FOUND')) return DomainErrors.doseNotFound(doseId);
  if (message.includes('DOSE_ALREADY_CONFIRMED')) return DomainErrors.doseAlreadyConfirmed(doseId);
  if (message.includes('TREATMENT_NOT_FOUND')) return DomainErrors.treatmentNotFound(doseId);
  // La versión de `confirm_dose_atomic` anterior a la migración 0007 todavía
  // tira esto. Se sigue traduciendo para que la app se comporte con sensatez
  // contra una base donde esa migración no se aplicó todavía.
  if (message.includes('STOCK_INSUFFICIENT')) return DomainErrors.insufficientStock(doseId);
  // Lo tira la migración 0008 cuando `doses_update_patient` frena el UPDATE:
  // el Cuidador PUEDE ver una toma pero solo el paciente puede confirmarla.
  if (message.includes('UNAUTHORIZED_ACTOR')) return DomainErrors.unauthorizedActor(doseId, 'confirmDose');
  return DomainErrors.repositoryFailure(new Error(message));
}

export class SupabaseDoseRepository implements DoseRepository {
  constructor(private readonly client: SupabaseClient) {}

  async createSlots(doses: readonly Dose[]): Promise<Result<readonly Dose[], DomainError>> {
    if (doses.length === 0) return Ok(doses);
    const { error } = await this.client
      .from('doses')
      .insert(doses.map((d) => ({ treatment_id: d.treatmentId, ...mapDoseToPayload(d) })));
    if (error) return Err(DomainErrors.repositoryFailure(error));
    return Ok(doses);
  }

  async findById(id: string): Promise<Result<Dose | null, DomainError>> {
    const { data, error } = await this.client.from('doses').select('*').eq('id', id).maybeSingle();
    if (error) return Err(DomainErrors.repositoryFailure(error));
    return Ok(data ? mapRowToDose(data as SupabaseDoseRow) : null);
  }

  async findPendingByPatientAndDate(
    patientId: string,
    date: Date,
  ): Promise<Result<readonly Dose[], DomainError>> {
    const { dayStart, dayEnd } = dayBounds(date);
    const { data, error } = await this.client
      .from('doses_with_patient')
      .select('*')
      .eq('patient_id', patientId)
      .eq('status', 'PENDING')
      .gte('scheduled_at', dayStart.toISOString())
      .lte('scheduled_at', dayEnd.toISOString())
      .order('scheduled_at', { ascending: true });
    if (error) return Err(DomainErrors.repositoryFailure(error));
    return Ok(((data ?? []) as DosesWithPatientRow[]).map(mapRowToDose));
  }

  async findAllByPatientAndDate(
    patientId: string,
    date: Date,
  ): Promise<Result<readonly Dose[], DomainError>> {
    const { dayStart, dayEnd } = dayBounds(date);
    const { data, error } = await this.client
      .from('doses_with_patient')
      .select('*')
      .eq('patient_id', patientId)
      .gte('scheduled_at', dayStart.toISOString())
      .lte('scheduled_at', dayEnd.toISOString())
      .order('scheduled_at', { ascending: true });
    if (error) return Err(DomainErrors.repositoryFailure(error));
    return Ok(((data ?? []) as DosesWithPatientRow[]).map(mapRowToDose));
  }

  async findByTreatmentInRange(
    treatmentId: string,
    from: Date,
    to: Date,
  ): Promise<Result<readonly Dose[], DomainError>> {
    const { data, error } = await this.client
      .from('doses')
      .select('*')
      .eq('treatment_id', treatmentId)
      .gte('scheduled_at', from.toISOString())
      .lte('scheduled_at', to.toISOString())
      .order('scheduled_at', { ascending: true });
    if (error) return Err(DomainErrors.repositoryFailure(error));
    return Ok(((data ?? []) as SupabaseDoseRow[]).map(mapRowToDose));
  }

  async findByPatientInRange(
    patientId: string,
    from: Date,
    to: Date,
  ): Promise<Result<readonly Dose[], DomainError>> {
    const { data, error } = await this.client
      .from('doses_with_patient')
      .select('*')
      .eq('patient_id', patientId)
      .gte('scheduled_at', from.toISOString())
      .lte('scheduled_at', to.toISOString())
      .order('scheduled_at', { ascending: true });
    if (error) return Err(DomainErrors.repositoryFailure(error));
    return Ok(((data ?? []) as DosesWithPatientRow[]).map(mapRowToDose));
  }

  async confirmDose(
    doseId: string,
    confirmedAt: Date,
    quantityTaken?: Dosage,
  ): Promise<Result<Dose, DomainError>> {
    const { data, error } = await this.client
      .from('doses')
      .update({
        status: 'TAKEN',
        confirmed_at: confirmedAt.toISOString(),
        quantity_taken_amount: quantityTaken?.amount ?? null,
        quantity_taken_unit: quantityTaken?.unit ?? null,
      })
      .eq('id', doseId)
      .eq('status', 'PENDING')
      .select('*')
      .maybeSingle();
    if (error) return Err(DomainErrors.repositoryFailure(error));
    if (!data) {
      const existing = await this.client.from('doses').select('id').eq('id', doseId).maybeSingle();
      return Err(existing.data ? DomainErrors.doseAlreadyConfirmed(doseId) : DomainErrors.doseNotFound(doseId));
    }
    return Ok(mapRowToDose(data as SupabaseDoseRow));
  }

  /** Ver `confirm_dose_atomic` en `supabase/migrations/` — un solo RPC transaccional (confirmar + descontar stock). */
  async confirmDoseWithStockDecrement(
    doseId: string,
    confirmedAt: Date,
    quantityTaken: Dosage,
  ): Promise<Result<{ dose: Dose; stock: StockInfo; stockWasShort: boolean }, DomainError>> {
    const { data, error } = await this.client.rpc('confirm_dose_atomic', {
      p_dose_id: doseId,
      p_confirmed_at: confirmedAt.toISOString(),
      p_quantity: quantityTaken.amount,
      p_quantity_unit: quantityTaken.unit,
    });
    if (error) return Err(mapConfirmRpcError(error.message, doseId));

    const payload = data as {
      dose: SupabaseDoseRow;
      stock: RpcStockRow;
      // Lo agrega la migración 0007. Contra una base anterior viene
      // `undefined`, que acá se lee como "no faltó nada" — y es cierto:
      // esa versión de la función no deja pasar una toma sin stock.
      stockShortfall?: number;
    };
    // Contra una base con 0007 aplicada y 0008 todavía no, un UPDATE que no
    // tocó ninguna fila vuelve como éxito con la toma en null. Mapear eso
    // produciría una toma inventada; se trata como lo que realmente es.
    if (!payload?.dose) return Err(DomainErrors.doseAlreadyConfirmed(doseId));

    return Ok({
      dose: mapRowToDose(payload.dose),
      stock: {
        currentQuantity: payload.stock.stock_current_quantity,
        dailyConsumption: payload.stock.stock_daily_consumption,
        unit: payload.stock.stock_unit as MeasurementUnit,
        criticalThresholdDays: payload.stock.stock_critical_threshold_days,
      },
      stockWasShort: (payload.stockShortfall ?? 0) > 0,
    });
  }

  async markMissed(doseId: string): Promise<Result<Dose, DomainError>> {
    const { data, error } = await this.client
      .from('doses')
      .update({ status: 'MISSED' })
      .eq('id', doseId)
      .eq('status', 'PENDING')
      .select('*')
      .maybeSingle();
    if (error) return Err(DomainErrors.repositoryFailure(error));
    if (!data) {
      const existing = await this.client.from('doses').select('status').eq('id', doseId).maybeSingle();
      if (!existing.data) return Err(DomainErrors.doseNotFound(doseId));
      return Err(DomainErrors.invalidStatusTransition((existing.data as { status: string }).status, 'MISSED'));
    }
    return Ok(mapRowToDose(data as SupabaseDoseRow));
  }
}
