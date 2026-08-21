import { Ok, Err, type Result, DomainErrors, type DomainError } from '../../../domain';
import type { TransactionRunner } from '../../../application';
import type { SQLiteDatabase, SQLiteExecutor } from './sqlite-executor.port';

/**
 * PIEZA CLAVE DE ATOMICIDAD.
 *
 * El puerto `TransactionRunner` de la capa de aplicación expone
 * `runInTransaction(work: () => Promise<Result<T>>)` — `work` NO recibe un
 * handle de transacción, porque la aplicación no debe conocer conceptos de
 * SQL. Pero los repos concretos SÍ necesitan ejecutar contra la misma
 * conexión/transacción para que `ConfirmDoseUseCase` (confirmar dose +
 * decrementar stock) sea atómico de verdad.
 *
 * Solución: este contexto mantiene "cuál es el executor activo ahora mismo"
 * (la DB raíz fuera de transacción, o el handle `tx` mientras hay una
 * abierta). Se inyecta LA MISMA INSTANCIA tanto en `SqliteTransactionRunner`
 * como en cada repo concreto (`SqliteTreatmentRepository`, etc.). Cada
 * repo pide `getExecutor()` en el momento de cada query — así, si esa query
 * ocurre dentro de un `runInTransaction`, automáticamente usa `tx` sin que
 * el repo ni el use case tengan que saberlo explícitamente.
 *
 * Es un Unit of Work simplificado, mono-conexión (correcto para SQLite
 * embebido, que no tiene pool de conexiones concurrentes).
 */
export class SqliteTransactionContext {
  private currentExecutor: SQLiteExecutor;

  constructor(private readonly rootDb: SQLiteDatabase) {
    this.currentExecutor = rootDb;
  }

  /** Los repos llaman esto antes de cada query, nunca guardan una referencia fija. */
  getExecutor(): SQLiteExecutor {
    return this.currentExecutor;
  }

  async runInTransaction<T>(work: () => Promise<T>): Promise<T> {
    return this.rootDb.transaction(async (tx) => {
      const previousExecutor = this.currentExecutor;
      this.currentExecutor = tx;
      try {
        return await work();
      } finally {
        // Se restaura incluso si `work` lanza — evita dejar el contexto
        // "pegado" a una transacción ya cerrada/rolled-back.
        this.currentExecutor = previousExecutor;
      }
    });
  }
}

/**
 * Adapter que implementa el puerto `TransactionRunner` de la capa de
 * aplicación por encima del `SqliteTransactionContext`. Traduce excepciones
 * nativas de SQLite (constraint violations, locks, etc.) a `DomainError`
 * en vez de dejarlas escapar como `throw` hacia el use case.
 */
export class SqliteTransactionRunner implements TransactionRunner {
  constructor(private readonly context: SqliteTransactionContext) {}

  async runInTransaction<T>(
    work: () => Promise<Result<T, DomainError>>,
  ): Promise<Result<T, DomainError>> {
    try {
      return await this.context.runInTransaction(work);
    } catch (cause) {
      return Err(DomainErrors.repositoryFailure(cause));
    }
  }
}
