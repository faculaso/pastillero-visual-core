import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInMemoryBetterSqlite3, type BetterSqlite3Adapter } from '../../src/infrastructure/persistence/sqlite/adapters/better-sqlite3.adapter';
import { MigrationRunner, type Migration } from '../../src/infrastructure/persistence/sqlite/migration-runner';
import { SqliteTransactionContext, SqliteTransactionRunner } from '../../src/infrastructure/persistence/sqlite/sqlite-transaction-context';

const MIGRATIONS_DIR = join(__dirname, '../../src/infrastructure/persistence/sqlite/migrations');

function loadMigrations(): Migration[] {
  return [
    {
      version: 1,
      name: '001_initial_schema',
      sql: readFileSync(join(MIGRATIONS_DIR, '001_initial_schema.sql'), 'utf-8'),
    },
    {
      version: 2,
      name: '002_anmat_catalog_fields',
      sql: readFileSync(join(MIGRATIONS_DIR, '002_anmat_catalog_fields.sql'), 'utf-8'),
    },
  ];
}

export interface TestDb {
  readonly db: BetterSqlite3Adapter;
  readonly context: SqliteTransactionContext;
  readonly transactionRunner: SqliteTransactionRunner;
}

/** Crea una DB SQLite en memoria, aplica todas las migraciones y devuelve el contexto transaccional listo para inyectar en los repos. */
export async function createTestDb(): Promise<TestDb> {
  const db = createInMemoryBetterSqlite3();
  const runner = new MigrationRunner(db);
  await runner.applyAll(loadMigrations());

  const context = new SqliteTransactionContext(db);
  const transactionRunner = new SqliteTransactionRunner(context);

  return { db, context, transactionRunner };
}

export { loadMigrations };
