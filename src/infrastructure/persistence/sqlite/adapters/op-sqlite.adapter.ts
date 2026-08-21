import type { DB, Transaction, QueryResult, Scalar } from '@op-engineering/op-sqlite';
import type {
  SQLiteDatabase,
  SQLiteExecutor,
  SQLiteExecResult,
  SQLiteRow,
} from '../sqlite-executor.port';

/**
 * Adapter de producción sobre `@op-engineering/op-sqlite`. Dos diferencias
 * respecto al `BetterSqlite3Adapter` (usado solo en tests) que hay que
 * puentear acá, verificadas contra los `.d.ts` reales del paquete instalado:
 *
 * 1. `DB.transaction(fn)` exige `fn: (tx) => Promise<void>` — NO propaga un
 *    valor de retorno como hace `better-sqlite3`. Nuestro puerto
 *    `SQLiteDatabase.transaction<T>()` sí necesita devolver `T`. Se resuelve
 *    con una variable capturada por closure (`capturedResult`) que `fn`
 *    asigna pero no retorna, cumpliendo la firma `Promise<void>` exigida.
 *
 * 2. `execute()` documentadamente "en nativo, corre solo el primer prepared
 *    statement" si el SQL trae múltiples statements (típico de una
 *    migración). Se resuelve partiendo el SQL por `;` y ejecutando cada
 *    statement por separado — ver `splitStatements`.
 *
 * BOOTSTRAP (acordado): la apertura del archivo vía `open({ name })` la hace
 * la app ANTES de instanciar este adapter — acá solo se recibe el `DB` ya
 * abierto e inyectado, nunca se llama `open()` desde infraestructura.
 */
export class OpSqliteAdapter implements SQLiteDatabase {
  constructor(private readonly db: DB) {}

  async execute(sql: string, params: readonly unknown[] = []): Promise<SQLiteExecResult> {
    const statements = splitStatements(sql);
    if (statements.length === 1) {
      const result = await this.db.execute(sql, toScalarParams(params));
      return toExecResult(result);
    }
    // Multi-statement (migraciones): op-sqlite solo corre el primer
    // statement por llamada, así que se ejecutan uno por uno en secuencia.
    // No se aceptan `params` acá a propósito: los callers de multi-statement
    // (MigrationRunner) siempre pasan SQL sin placeholders.
    let last: SQLiteExecResult = { rowsAffected: 0 };
    for (const statement of statements) {
      last = toExecResult(await this.db.execute(statement));
    }
    return last;
  }

  async queryAll<T = SQLiteRow>(sql: string, params: readonly unknown[] = []): Promise<readonly T[]> {
    const result = await this.db.execute(sql, toScalarParams(params));
    return (result.rows as unknown as T[]) ?? [];
  }

  async queryOne<T = SQLiteRow>(sql: string, params: readonly unknown[] = []): Promise<T | null> {
    const result = await this.db.execute(sql, toScalarParams(params));
    const row = (result.rows as unknown as T[])?.[0];
    return row ?? null;
  }

  async transaction<T>(work: (tx: SQLiteExecutor) => Promise<T>): Promise<T> {
    let capturedResult: T;
    let capturedError: unknown;

    await this.db.transaction(async (tx: Transaction) => {
      try {
        capturedResult = await work(wrapTransaction(tx));
      } catch (error) {
        // Re-lanzar DENTRO del callback es lo que dispara el ROLLBACK
        // automático de op-sqlite (documentado: "Any uncatched error
        // ROLLBACK transaction"). Guardamos el error para re-lanzarlo
        // también afuera, una vez que `db.transaction` ya resolvió/rechazó.
        capturedError = error;
        throw error;
      }
      // Sin `return`: `fn` debe resolver `Promise<void>`, el valor real
      // viaja por `capturedResult`, no por el retorno de este callback.
    });

    if (capturedError !== undefined) throw capturedError;
    return capturedResult!;
  }

  close(): void {
    this.db.close();
  }
}

/** Envuelve una `Transaction` de op-sqlite para que cumpla `SQLiteExecutor` (misma forma que el `DB` raíz). */
function wrapTransaction(tx: Transaction): SQLiteExecutor {
  return {
    async execute(sql: string, params: readonly unknown[] = []): Promise<SQLiteExecResult> {
      const statements = splitStatements(sql);
      if (statements.length === 1) {
        return toExecResult(await tx.execute(sql, toScalarParams(params)));
      }
      let last: SQLiteExecResult = { rowsAffected: 0 };
      for (const statement of statements) {
        last = toExecResult(await tx.execute(statement));
      }
      return last;
    },
    async queryAll<T = SQLiteRow>(sql: string, params: readonly unknown[] = []): Promise<readonly T[]> {
      const result = await tx.execute(sql, toScalarParams(params));
      return (result.rows as unknown as T[]) ?? [];
    },
    async queryOne<T = SQLiteRow>(sql: string, params: readonly unknown[] = []): Promise<T | null> {
      const result = await tx.execute(sql, toScalarParams(params));
      const row = (result.rows as unknown as T[])?.[0];
      return row ?? null;
    },
  };
}

function toExecResult(result: QueryResult): SQLiteExecResult {
  return { rowsAffected: result.rowsAffected, insertId: result.insertId };
}

/** op-sqlite tipa params como `Scalar[]` (string|number|boolean|null|ArrayBuffer|...); nuestro puerto usa `unknown[]` para no filtrar ese tipo a la capa de dominio. */
function toScalarParams(params: readonly unknown[]): Scalar[] {
  return params as Scalar[];
}

/**
 * Split que respeta bloques `BEGIN...END` (triggers): un split naive por
 * `;` de fin de línea cortaría en medio del cuerpo de un trigger (que
 * contiene sus propios `;` internos). Cuenta profundidad de BEGIN/END y
 * solo corta cuando la profundidad vuelve a 0 — suficiente para DDL simple
 * sin triggers anidados. Si en el futuro hace falta SQL más complejo
 * (CTEs con `;` en subqueries raras, etc.), esto debe reemplazarse por un
 * tokenizer real; se deja documentado como límite conocido.
 */
export function splitStatements(sql: string): string[] {
  const rawParts = sql.split(';');
  const statements: string[] = [];
  let buffer = '';
  let beginDepth = 0;

  for (const part of rawParts) {
    buffer += buffer.length > 0 ? `;${part}` : part;
    beginDepth += countKeyword(part, 'BEGIN') - countKeyword(part, 'END');

    if (beginDepth <= 0) {
      const statement = buffer.trim();
      if (statement.length > 0) statements.push(statement);
      buffer = '';
      beginDepth = 0;
    }
  }

  const trailing = buffer.trim();
  if (trailing.length > 0) statements.push(trailing);

  return statements;
}

function countKeyword(text: string, keyword: string): number {
  const pattern = new RegExp(`\\b${keyword}\\b`, 'gi');
  return (text.match(pattern) ?? []).length;
}
