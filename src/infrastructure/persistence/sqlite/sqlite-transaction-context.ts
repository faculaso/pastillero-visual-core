import type { SQLiteDatabase, SQLiteExecutor } from './sqlite-executor.port';

/**
 * PIEZA CLAVE DE ATOMICIDAD.
 *
 * Ya NO existe un puerto `TransactionRunner` genérico en la capa de
 * aplicación — se eliminó porque no es portable a un backend sin
 * transacciones cross-request (Supabase/PostgREST). En su lugar, cada
 * operación que necesita atomidad real es UN SOLO método de repositorio
 * (`TreatmentRepository.createWithInitialDoses`,
 * `DoseRepository.confirmDoseWithStockDecrement`) que abre y cierra su
 * propia transacción acá adentro, sin que el use case sepa nada de SQL.
 *
 * Este contexto mantiene "cuál es el executor activo ahora mismo" (la DB
 * raíz fuera de transacción, o el handle `tx` mientras hay una abierta). Se
 * inyecta LA MISMA INSTANCIA en cada repo concreto (`SqliteTreatmentRepository`,
 * etc.). Cada repo pide `getExecutor()` en el momento de cada query — así,
 * si esa query ocurre dentro de un `runInTransaction` que el propio repo
 * abrió, automáticamente usa `tx`.
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
