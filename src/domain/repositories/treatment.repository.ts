import type { Result } from '../core/result';
import type { DomainError } from '../errors/domain.errors';
import type { Treatment } from '../entities/treatment.entity';

/**
 * Puerto de persistencia del agregado Treatment. La implementación
 * offline-first debe escribir primero a almacenamiento local (SQLite/WatermelonDB)
 * y encolar sincronización remota; ese detalle vive en infraestructura.
 */
export interface TreatmentRepository {
  create(treatment: Treatment): Promise<Result<Treatment, DomainError>>;
  update(treatment: Treatment): Promise<Result<Treatment, DomainError>>;
  findById(id: string): Promise<Result<Treatment | null, DomainError>>;
  findActiveByPatient(patientId: string): Promise<Result<readonly Treatment[], DomainError>>;
  findAllByCaregiver(caregiverId: string): Promise<Result<readonly Treatment[], DomainError>>;
  delete(id: string): Promise<Result<void, DomainError>>;
}
