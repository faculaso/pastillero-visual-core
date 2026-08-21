import Database from 'better-sqlite3';
import type {
  SQLiteDatabase,
  SQLiteExecutor,
  SQLiteExecResult,
  SQLiteRow,
} from '../sqlite-executor.port';

/**
 * Adapter real sobre `better-sqlite3` (API síncrona, envuelta en Promises
 * para cumplir el puerto). Usos:
 *  1. Tests de integración (CI, sin dispositivo/emulador).
 *  2. Reutilizable tal cual para una eventual versión desktop (Electron) del
 *     mismo Core, ya que el dominio/aplicación no cambian entre plataformas.
 *
 * `execute()` intenta `prepare().run()` (rápido, da `rowsAffected` real);
 * si el SQL trae múltiples statements (típico de una migración), cae a
 * `db.exec()` — better-sqlite3 no permite `prepare` de multi-statement.
 */
export class BetterSqlite3Adapter implements SQLiteDatabase {
  constructor(private readonly db: Database.Database) {
    this.db.pragma('foreign_keys = ON');
  }

  async execute(sql: string, params: readonly unknown[] = []): Promise<SQLiteExecResult> {
    try {
      const stmt = this.db.prepare(sql);
      const info = stmt.run(...(params as unknown[]));
      return { rowsAffected: info.changes, insertId: Number(info.lastInsertRowid) };
    } catch (error) {
      if (error instanceof Error && /more than one statement/i.test(error.message)) {
        this.db.exec(sql);
        return { rowsAffected: 0 };
      }
      throw error;
    }
  }

  async queryAll<T = SQLiteRow>(sql: string, params: readonly unknown[] = []): Promise<readonly T[]> {
    const stmt = this.db.prepare(sql);
    return stmt.all(...(params as unknown[])) as T[];
  }

  async queryOne<T = SQLiteRow>(sql: string, params: readonly unknown[] = []): Promise<T | null> {
    const stmt = this.db.prepare(sql);
    const row = stmt.get(...(params as unknown[]));
    return (row as T | undefined) ?? null;
  }

  /**
   * better-sqlite3 no soporta transacciones async nativas (`db.transaction()`
   * exige una función síncrona). Se emula manualmente con BEGIN/COMMIT/ROLLBACK
   * — seguro acá porque better-sqlite3 es single-connection por instancia,
   * no hay riesgo de que otra conexión intercale statements.
   */
  async transaction<T>(work: (tx: SQLiteExecutor) => Promise<T>): Promise<T> {
    this.db.exec('BEGIN');
    try {
      const result = await work(this);
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  close(): void {
    this.db.close();
  }
}

/** Factory de conveniencia para tests: DB en memoria + FKs activas. */
export function createInMemoryBetterSqlite3(): BetterSqlite3Adapter {
  const db = new Database(':memory:');
  return new BetterSqlite3Adapter(db);
}

/** Factory para abrir/crear un archivo .db real — usado por scripts de ingesta (Node/CI, no RN). */
export function openBetterSqlite3File(path: string): BetterSqlite3Adapter {
  const db = new Database(path);
  return new BetterSqlite3Adapter(db);
}
