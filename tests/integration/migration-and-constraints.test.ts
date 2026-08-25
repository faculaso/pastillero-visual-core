import { describe, it, expect } from 'vitest';
import { createTestDb, loadMigrations } from './test-db';
import { MigrationRunner } from '../../src/infrastructure/persistence/sqlite/migration-runner';

describe('MigrationRunner + esquema SQLite', () => {
  it('aplica las migraciones y registra las versiones en schema_migrations', async () => {
    const { db } = await createTestDb();
    const rows = await db.queryAll<{ version: number; name: string }>(
      `SELECT version, name FROM schema_migrations ORDER BY version`,
    );
    expect(rows).toEqual([
      { version: 1, name: '001_initial_schema' },
      { version: 2, name: '002_anmat_catalog_fields' },
      { version: 3, name: '003_capsule_bicolor_shape' },
    ]);
  });

  it('correr applyAll dos veces es idempotente (no reaplica ni duplica filas)', async () => {
    const { db } = await createTestDb();
    const runner = new MigrationRunner(db);
    await runner.applyAll(loadMigrations()); // segunda pasada

    const rows = await db.queryAll(`SELECT * FROM schema_migrations`);
    expect(rows).toHaveLength(3);
  });

  it('crea las tablas esperadas', async () => {
    const { db } = await createTestDb();
    const tables = await db.queryAll<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`,
    );
    const names = tables.map((t) => t.name);
    expect(names).toEqual(expect.arrayContaining(['medications', 'treatments', 'doses', 'schema_migrations']));
  });

  it('FTS5 queda creado, poblado por el backfill y sincronizado por los triggers', async () => {
    const { db } = await createTestDb();

    await db.execute(
      `INSERT INTO medications (id, name, active_ingredient, laboratory, presentation) VALUES ('m1','Paracetamol','Paracetamol','Lab X','x')`,
    );

    const viaFts = await db.queryAll<{ name: string }>(
      `SELECT m.name FROM medications_fts f JOIN medications m ON m.rowid = f.rowid WHERE medications_fts MATCH 'paracet*'`,
    );
    expect(viaFts.map((r) => r.name)).toEqual(['Paracetamol']);

    await db.execute(`UPDATE medications SET name = 'Ibuprofeno', active_ingredient = 'Ibuprofeno' WHERE id = 'm1'`);
    const afterUpdate = await db.queryAll(
      `SELECT rowid FROM medications_fts WHERE medications_fts MATCH 'paracet*'`,
    );
    expect(afterUpdate).toHaveLength(0); // el trigger AU debe haber quitado el valor viejo del índice

    await db.execute(`DELETE FROM medications WHERE id = 'm1'`);
    const afterDelete = await db.queryAll(
      `SELECT rowid FROM medications_fts WHERE medications_fts MATCH 'ibuprofeno*'`,
    );
    expect(afterDelete).toHaveLength(0); // el trigger AD debe haber limpiado el índice
  });

  it('CHECK constraint rechaza stock_current_quantity negativo', async () => {
    const { db } = await createTestDb();
    await db.execute(
      `INSERT INTO medications (id, name, active_ingredient, laboratory, presentation) VALUES ('m1','X','X','X','X')`,
    );

    await expect(
      db.execute(
        `INSERT INTO treatments (
           id, patient_id, caregiver_id, medication_id, status,
           visual_shape, visual_color,
           dosage_frequency, dosage_amount, dosage_unit, dosage_start_date,
           stock_current_quantity, stock_daily_consumption, stock_unit,
           created_at, updated_at
         ) VALUES (
           't1','p1','c1','m1','ACTIVE',
           'ROUND','#FFFFFF',
           'DAILY',1,'UNIT','2026-08-01T00:00:00.000Z',
           -1, 1, 'UNIT',
           '2026-08-01T00:00:00.000Z','2026-08-01T00:00:00.000Z'
         )`,
      ),
    ).rejects.toThrow();
  });

  it('CHECK constraint rechaza status fuera del enum', async () => {
    const { db } = await createTestDb();
    await db.execute(
      `INSERT INTO medications (id, name, active_ingredient, laboratory, presentation) VALUES ('m1','X','X','X','X')`,
    );
    await expect(
      db.execute(
        `INSERT INTO treatments (
           id, patient_id, caregiver_id, medication_id, status,
           visual_shape, visual_color,
           dosage_frequency, dosage_amount, dosage_unit, dosage_start_date,
           stock_current_quantity, stock_daily_consumption, stock_unit,
           created_at, updated_at
         ) VALUES (
           't1','p1','c1','m1','NOT_A_STATUS',
           'ROUND','#FFFFFF',
           'DAILY',1,'UNIT','2026-08-01T00:00:00.000Z',
           1, 1, 'UNIT',
           '2026-08-01T00:00:00.000Z','2026-08-01T00:00:00.000Z'
         )`,
      ),
    ).rejects.toThrow();
  });

  it('ON DELETE CASCADE borra las doses al borrar el treatment', async () => {
    const { db } = await createTestDb();
    await db.execute(
      `INSERT INTO medications (id, name, active_ingredient, laboratory, presentation) VALUES ('m1','X','X','X','X')`,
    );
    await db.execute(
      `INSERT INTO treatments (
         id, patient_id, caregiver_id, medication_id, status,
         visual_shape, visual_color,
         dosage_frequency, dosage_amount, dosage_unit, dosage_start_date,
         stock_current_quantity, stock_daily_consumption, stock_unit,
         created_at, updated_at
       ) VALUES (
         't1','p1','c1','m1','ACTIVE',
         'ROUND','#FFFFFF',
         'DAILY',1,'UNIT','2026-08-01T00:00:00.000Z',
         10, 1, 'UNIT',
         '2026-08-01T00:00:00.000Z','2026-08-01T00:00:00.000Z'
       )`,
    );
    await db.execute(
      `INSERT INTO doses (id, treatment_id, scheduled_at, status) VALUES ('d1','t1','2026-08-01T08:00:00.000Z','PENDING')`,
    );

    await db.execute(`DELETE FROM treatments WHERE id = 't1'`);

    const remaining = await db.queryAll(`SELECT * FROM doses WHERE id = 'd1'`);
    expect(remaining).toHaveLength(0);
  });
});
