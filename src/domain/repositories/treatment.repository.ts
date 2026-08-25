import type { Result } from '../core/result';
import type { DomainError } from '../errors/domain.errors';
import type { Treatment } from '../entities/treatment.entity';
import type { Dose } from '../entities/dose.entity';

/**
 * Puerto de persistencia del agregado Treatment. La implementación
 * offline-first debe escribir primero a almacenamiento local (SQLite/WatermelonDB)
 * y encolar sincronización remota; ese detalle vive en infraestructura.
 */
export interface TreatmentRepository {
  create(treatment: Treatment): Promise<Result<Treatment, DomainError>>;
  /**
   * Crea el tratamiento + sus slots de `Dose` iniciales en una sola
   * operación atómica (todo o nada) — reemplaza la orquestación previa vía
   * `TransactionRunner` (`RegisterTreatmentUseCase` + `create` /
   * `DoseRepository.createSlots` por separado), que no es portable a un
   * backend sin transacciones cross-request (ver implementación Supabase,
   * que usa una función RPC para esto).
   */
  createWithInitialDoses(
    treatment: Treatment,
    doses: readonly Dose[],
  ): Promise<Result<{ readonly treatment: Treatment; readonly generatedDoses: readonly Dose[] }, DomainError>>;
  update(treatment: Treatment): Promise<Result<Treatment, DomainError>>;
  findById(id: string): Promise<Result<Treatment | null, DomainError>>;
  findActiveByPatient(patientId: string): Promise<Result<readonly Treatment[], DomainError>>;
  findAllByCaregiver(caregiverId: string): Promise<Result<readonly Treatment[], DomainError>>;
  delete(id: string): Promise<Result<void, DomainError>>;
}
