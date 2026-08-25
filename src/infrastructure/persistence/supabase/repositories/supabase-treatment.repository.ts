import type { SupabaseClient } from '@supabase/supabase-js';
import { Ok, Err, type Result, DomainErrors, type DomainError } from '../../../../domain';
import type { Treatment, TreatmentRepository, Dose, MedicationCatalogRepository, Medication } from '../../../../domain';
import {
  mapRowToTreatment,
  mapTreatmentToPayload,
  fallbackMedication,
  type SupabaseTreatmentRow,
} from '../mappers/treatment.mapper';
import { mapDoseToPayload } from '../mappers/dose.mapper';

/**
 * Implementación Supabase del puerto `TreatmentRepository`. El catálogo
 * ANMAT no vive en Supabase (sigue siendo local en cada dispositivo, ver
 * `bootstrap.ts`) — por eso este repo recibe también el
 * `MedicationCatalogRepository` local, únicamente para RESOLVER el
 * medicamento completo (nombre, laboratorio, presentación...) a partir del
 * snapshot (`medication_catalog_id`/`medication_name`) que sí viaja en cada
 * fila de `treatments`. No hay otra forma de reconstruir esos datos sin
 * mover el catálogo entero al servidor, que quedó fuera de alcance.
 */
export class SupabaseTreatmentRepository implements TreatmentRepository {
  constructor(
    private readonly client: SupabaseClient,
    private readonly medicationCatalog: MedicationCatalogRepository,
  ) {}

  async create(treatment: Treatment): Promise<Result<Treatment, DomainError>> {
    const { error } = await this.client.from('treatments').insert({
      id: treatment.id,
      ...mapTreatmentToPayload(treatment),
      created_at: treatment.createdAt.toISOString(),
      updated_at: treatment.updatedAt.toISOString(),
    });
    if (error) return Err(DomainErrors.repositoryFailure(error));
    return Ok(treatment);
  }

  /** Ver `register_treatment_with_doses` en `supabase/migrations/` — un solo RPC transaccional en vez de dos escrituras separadas. */
  async createWithInitialDoses(
    treatment: Treatment,
    doses: readonly Dose[],
  ): Promise<Result<{ treatment: Treatment; generatedDoses: readonly Dose[] }, DomainError>> {
    const { error } = await this.client.rpc('register_treatment_with_doses', {
      p_treatment: { id: treatment.id, ...mapTreatmentToPayload(treatment) },
      p_doses: doses.map(mapDoseToPayload),
    });
    if (error) return Err(DomainErrors.repositoryFailure(error));
    // Los ids ya son los que generó `IdGenerator` del lado del cliente (ver
    // la RPC) — no hace falta re-leer ni re-mapear la respuesta del server,
    // `treatment`/`doses` ya reflejan exactamente lo que quedó persistido.
    return Ok({ treatment, generatedDoses: doses });
  }

  async update(treatment: Treatment): Promise<Result<Treatment, DomainError>> {
    const { error } = await this.client
      .from('treatments')
      .update({
        ...mapTreatmentToPayload(treatment),
        updated_at: treatment.updatedAt.toISOString(),
      })
      .eq('id', treatment.id);
    if (error) return Err(DomainErrors.repositoryFailure(error));
    return Ok(treatment);
  }

  async findById(id: string): Promise<Result<Treatment | null, DomainError>> {
    const { data, error } = await this.client.from('treatments').select('*').eq('id', id).maybeSingle();
    if (error) return Err(DomainErrors.repositoryFailure(error));
    if (!data) return Ok(null);
    const row = data as SupabaseTreatmentRow;
    return Ok(mapRowToTreatment(row, await this.resolveMedication(row)));
  }

  async findActiveByPatient(patientId: string): Promise<Result<readonly Treatment[], DomainError>> {
    const { data, error } = await this.client
      .from('treatments')
      .select('*')
      .eq('patient_id', patientId)
      .eq('status', 'ACTIVE');
    if (error) return Err(DomainErrors.repositoryFailure(error));
    return Ok(await this.mapRows((data ?? []) as SupabaseTreatmentRow[]));
  }

  async findAllByCaregiver(caregiverId: string): Promise<Result<readonly Treatment[], DomainError>> {
    const { data, error } = await this.client.from('treatments').select('*').eq('caregiver_id', caregiverId);
    if (error) return Err(DomainErrors.repositoryFailure(error));
    return Ok(await this.mapRows((data ?? []) as SupabaseTreatmentRow[]));
  }

  async delete(id: string): Promise<Result<void, DomainError>> {
    const { error } = await this.client.from('treatments').delete().eq('id', id);
    if (error) return Err(DomainErrors.repositoryFailure(error));
    return Ok(undefined);
  }

  private async resolveMedication(row: SupabaseTreatmentRow): Promise<Medication> {
    const result = await this.medicationCatalog.findById(row.medication_catalog_id);
    if (result.ok && result.value) return result.value;
    return fallbackMedication(row);
  }

  private async mapRows(rows: readonly SupabaseTreatmentRow[]): Promise<Treatment[]> {
    const treatments: Treatment[] = [];
    for (const row of rows) {
      treatments.push(mapRowToTreatment(row, await this.resolveMedication(row)));
    }
    return treatments;
  }
}
