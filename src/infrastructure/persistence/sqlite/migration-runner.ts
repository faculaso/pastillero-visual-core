import type { SQLiteDatabase } from './sqlite-executor.port';

export interface Migration {
  readonly version: number;
  readonly name: string;
  readonly sql: string;
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
        await tx.execute(migration.sql);
        await tx.execute(`INSERT INTO schema_migrations (version, name) VALUES (?, ?)`, [
          migration.version,
          migration.name,
        ]);
      });
    }
  }
}
