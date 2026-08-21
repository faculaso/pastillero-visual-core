import { describe, it, expect } from 'vitest';
import { OpSqliteAdapter } from '../../src/infrastructure/persistence/sqlite/adapters/op-sqlite.adapter';
import { FakeOpSqliteDb } from '../support/fake-op-sqlite-db';
import type { DB } from '@op-engineering/op-sqlite';

describe('OpSqliteAdapter', () => {
  it('execute() ejecuta un statement simple y mapea rowsAffected/insertId', async () => {
    const fakeDb = new FakeOpSqliteDb();
    const adapter = new OpSqliteAdapter(fakeDb as unknown as DB);

    const result = await adapter.execute(`INSERT INTO items (id, value) VALUES (?, ?)`, ['i1', 'hello']);
    expect(result.rowsAffected).toBe(1);
  });

  it('queryAll() retorna las filas como array tipado', async () => {
    const fakeDb = new FakeOpSqliteDb();
    fakeDb.seed('items', [{ id: 'i1', value: 'a' }, { id: 'i2', value: 'b' }]);
    const adapter = new OpSqliteAdapter(fakeDb as unknown as DB);

    const rows = await adapter.queryAll<{ id: string; value: string }>(`SELECT * FROM items`);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.id)).toEqual(['i1', 'i2']);
  });

  it('queryOne() retorna null si no hay filas', async () => {
    const fakeDb = new FakeOpSqliteDb();
    const adapter = new OpSqliteAdapter(fakeDb as unknown as DB);
    const row = await adapter.queryOne(`SELECT * FROM items`);
    expect(row).toBeNull();
  });

  it('transaction() PUENTEA correctamente el valor de retorno pese a que op-sqlite exige fn: Promise<void>', async () => {
    const fakeDb = new FakeOpSqliteDb();
    const adapter = new OpSqliteAdapter(fakeDb as unknown as DB);

    const result = await adapter.transaction(async (tx) => {
      await tx.execute(`INSERT INTO items (id, value) VALUES (?, ?)`, ['i1', 'x']);
      return { ok: true as const, value: 42 };
    });

    expect(result).toEqual({ ok: true, value: 42 });
  });

  it('transaction() propaga el error y revierte el estado si work() lanza (rollback real del fake)', async () => {
    const fakeDb = new FakeOpSqliteDb();
    fakeDb.seed('items', [{ id: 'i1', value: 'original' }]);
    const adapter = new OpSqliteAdapter(fakeDb as unknown as DB);

    await expect(
      adapter.transaction(async (tx) => {
        await tx.execute(`UPDATE items SET value = ? WHERE id = ?`, ['modificado', 'i1']);
        throw new Error('fallo simulado dentro de la transacción');
      }),
    ).rejects.toThrow('fallo simulado dentro de la transacción');

    // El fake revierte al snapshot previo ante el throw no atrapado.
    expect(fakeDb.getTable('items')).toEqual([{ id: 'i1', value: 'original' }]);
  });

  it('execute() con SQL multi-statement lo parte y ejecuta cada uno (limitación documentada de op-sqlite nativo)', async () => {
    const fakeDb = new FakeOpSqliteDb();
    const adapter = new OpSqliteAdapter(fakeDb as unknown as DB);

    // Dos INSERTs en un solo string, como vendría de un archivo de migración.
    const multiSql = `
      INSERT INTO items (id, value) VALUES ('i1', 'a');
      INSERT INTO items (id, value) VALUES ('i2', 'b');
    `;
    await adapter.execute(multiSql);

    const rows = await adapter.queryAll(`SELECT * FROM items`);
    expect(rows).toHaveLength(2);
  });
});
