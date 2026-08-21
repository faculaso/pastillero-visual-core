import type { Result } from '../../domain';
import type { DomainError } from '../../domain';

/**
 * Boundary transaccional para operaciones que tocan más de un repositorio
 * y deben ser atómicas a nivel de almacenamiento local (p. ej. confirmar
 * una toma + decrementar stock: CU-02 pasos 5-6). La implementación en
 * infraestructura envuelve esto en una transacción SQLite/WatermelonDB;
 * si `work` retorna `Err`, la infra debe hacer rollback.
 */
export interface TransactionRunner {
  runInTransaction<T>(
    work: () => Promise<Result<T, DomainError>>,
  ): Promise<Result<T, DomainError>>;
}
