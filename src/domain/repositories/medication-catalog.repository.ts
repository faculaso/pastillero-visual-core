import type { Result } from '../core/result';
import type { DomainError } from '../errors/domain.errors';
import type { Medication } from '../entities/medication.entity';

/**
 * Puerto hacia el catálogo Vademécum/ANMAT (CU-01 pasos 2-5).
 * Implementación remota debe cachear localmente para soporte offline-first
 * en búsquedas ya realizadas — eso se resuelve en infraestructura, no acá.
 */
export interface MedicationCatalogRepository {
  searchByText(query: string): Promise<Result<readonly Medication[], DomainError>>;
  searchByBarcode(barcode: string): Promise<Result<Medication | null, DomainError>>;
  findById(id: string): Promise<Result<Medication | null, DomainError>>;
  /** Lista medicamentos del catálogo sin necesidad de un texto de búsqueda (orden alfabético). */
  listAll(limit?: number): Promise<Result<readonly Medication[], DomainError>>;
}
