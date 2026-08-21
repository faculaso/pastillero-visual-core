import { describe, it, expect } from 'vitest';
import { splitStatements } from '../../src/infrastructure/persistence/sqlite/adapters/op-sqlite.adapter';

describe('splitStatements', () => {
  it('separa statements simples por `;`', () => {
    const result = splitStatements(`CREATE TABLE a (id TEXT);\nCREATE TABLE b (id TEXT);`);
    expect(result).toHaveLength(2);
    expect(result[0]).toContain('CREATE TABLE a');
    expect(result[1]).toContain('CREATE TABLE b');
  });

  it('NO corta los `;` internos de un bloque BEGIN...END (trigger)', () => {
    const sql = `
      CREATE TABLE items (id TEXT);
      CREATE TRIGGER items_ai AFTER INSERT ON items BEGIN
        INSERT INTO log(msg) VALUES ('a');
        INSERT INTO log(msg) VALUES ('b');
      END;
      CREATE TABLE other (id TEXT);
    `;
    const result = splitStatements(sql);
    expect(result).toHaveLength(3);
    expect(result[1]).toContain('BEGIN');
    expect(result[1]).toContain('END');
    expect(result[1]).toContain("VALUES ('a')");
    expect(result[1]).toContain("VALUES ('b')");
  });

  it('maneja múltiples triggers consecutivos sin mezclar sus cuerpos', () => {
    const sql = `
      CREATE TRIGGER t1 AFTER INSERT ON x BEGIN
        SELECT 1;
      END;
      CREATE TRIGGER t2 AFTER DELETE ON x BEGIN
        SELECT 2;
      END;
    `;
    const result = splitStatements(sql);
    expect(result).toHaveLength(2);
    expect(result[0]).toContain('t1');
    expect(result[0]).not.toContain('t2');
    expect(result[1]).toContain('t2');
    expect(result[1]).not.toContain('SELECT 1');
  });

  it('ignora fragmentos vacíos (statement final terminado en `;`)', () => {
    const result = splitStatements(`CREATE TABLE a (id TEXT);`);
    expect(result).toHaveLength(1);
  });
});
