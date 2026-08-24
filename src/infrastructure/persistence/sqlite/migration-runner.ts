import type { SQLiteDatabase } from './sqlite-executor.port';

export interface Migration {
  readonly version: number;
  readonly name: string;
  readonly sql: string;
}

const OPTIONAL_BLOCK_START = '-- OPTIONAL:BEGIN';
const OPTIONAL_BLOCK_END = '-- OPTIONAL:END';

/**
 * Separa un bloque delimitado por marcadores `-- OPTIONAL:BEGIN` / `-- OPTIONAL:END`
 * del resto del SQL de una migración — ver el bloque FTS5 de
 * `002_anmat_catalog_fields.sql` para el caso real que motivó esto: algunos
 * builds de SQLite (op-sqlite en Android sin FTS5 compilado, confirmado en
 * dispositivo real) tiran "no such module: fts5" ahí. Sin este split, ese
 * error aborta la transacción entera y hace ROLLBACK también de las columnas
 * ALTER TABLE que sí deben aplicarse sí o sí.
 */
export function splitOptionalBlock(sql: string): { readonly core: string; readonly optional: string | null } {
  const startIndex = sql.indexOf(OPTIONAL_BLOCK_START);
  const endIndex = sql.indexOf(OPTIONAL_BLOCK_END);
  if (startIndex === -1 || endIndex === -1) return { core: sql, optional: null };

  const core = sql.slice(0, startIndex) + sql.slice(endIndex + OPTIONAL_BLOCK_END.length);
  const optional = sql.slice(startIndex + OPTIONAL_BLOCK_START.length, endIndex);
  return { core, optional };
}

/**
 * Runner mínimo de migraciones versionadas. Registra cada migración
 * aplicada en `schema_migrations` para que correr `applyAll` en cada
 * arranque de la app sea idempotente (no reaplica lo ya ejecutado) —
 * necesario en offline-first, donde no hay un paso de "deploy" separado.
 */
export class MigrationRunner {
  constructor(private readonly db: SQLiteDatabase) {}

  async applyAll(migrations: readonly Migration[]): Promise<void> {
    await this.db.execute(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
         version INTEGER PRIMARY KEY,
         name TEXT NOT NULL,
         applied_at TEXT NOT NULL DEFAULT (datetime('now'))
       )`,
    );

    const applied = await this.db.queryAll<{ version: number }>(
      `SELECT version FROM schema_migrations`,
    );
    const appliedVersions = new Set(applied.map((r) => r.version));

    const pending = [...migrations].sort((a, b) => a.version - b.version);

    for (const migration of pending) {
      if (appliedVersions.has(migration.version)) continue;

      await this.db.transaction(async (tx) => {
        // Nota: `execute` de un solo string con múltiples statements depende
        // del driver concreto (algunos requieren `executeMultiple`). Este
        // runner asume que el `SQLiteExecutor` adapter soporta multi-statement;
        // si no, dividir `migration.sql` por `;` antes de este loop.
        const { core, optional } = splitOptionalBlock(migration.sql);
        await tx.execute(core);

        if (optional) {
          try {
            await tx.execute(optional);
          } catch {
            // Best-effort: el bloque opcional depende de una capability del
            // build de SQLite (ej. FTS5) que puede no estar disponible — se
            // descarta el error en vez de abortar toda la migración. Los
            // repositorios que dependen de esa capability ya la detectan en
            // runtime y caen a un fallback (ver SqliteMedicationCatalogRepository).
          }
        }

        await tx.execute(`INSERT INTO schema_migrations (version, name) VALUES (?, ?)`, [
          migration.version,
          migration.name,
        ]);
      });
    }
  }
}
