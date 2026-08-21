import { describe, it, expect, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';

const SCRIPT_PATH = join(__dirname, '../../scripts/seed-anmat-catalog.ts');

const SAMPLE_CSV = `nro_certificado;nombre_comercial;generico_droga;forma_farmaceutica;concentracion;presentacion_unidades;laboratorio
55.123;Actron;Ibuprofeno;COMPRIMIDOS RECUBIERTOS;400 MG;ENVASE X 10 COMPRIMIDOS;Bayer
60.001;Paracetamol Genérico;Paracetamol;COMPRIMIDOS;500 MG;ENVASE X 20 COMPRIMIDOS;Lab Genérico SA
;;;;;;
`;

/**
 * Corre el script como proceso real (no importa sus funciones internas):
 * es justamente lo que hubiera atrapado el bug real que encontramos acá
 * (el script importaba el barrel de infra, que arrastraba `bootstrap.ts`
 * -> `@op-engineering/op-sqlite`, un import de valor que revienta en Node
 * puro). Un test que solo probara `parseAnmatCsvRow` en aislamiento nunca
 * hubiera detectado ese problema de wiring.
 */
function runScript(args: readonly string[]): { stdout: string; status: number } {
  try {
    const stdout = execFileSync('npx', ['tsx', SCRIPT_PATH, ...args], {
      encoding: 'utf-8',
      cwd: join(__dirname, '../..'),
    });
    return { stdout, status: 0 };
  } catch (error) {
    const execError = error as { stdout?: string; status?: number };
    return { stdout: execError.stdout ?? '', status: execError.status ?? 1 };
  }
}

describe('seed-anmat-catalog.ts (script real, proceso spawneado)', () => {
  let dir: string;

  afterEach(() => {
    if (dir && existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  });

  it('ingesta un CSV válido, descarta filas inválidas, y los datos quedan buscables', () => {
    dir = mkdtempSync(join(tmpdir(), 'anmat-test-'));
    const csvPath = join(dir, 'sample.csv');
    const dbPath = join(dir, 'test.db');
    writeFileSync(csvPath, SAMPLE_CSV, 'utf-8');

    const { stdout, status } = runScript(['--input', csvPath, '--db', dbPath]);

    expect(status).toBe(0);
    expect(stdout).toContain('Válidas:         2');
    expect(stdout).toContain('Inválidas:       1');
    expect(stdout).toContain('Escritas (OK):   2');

    const db = new Database(dbPath, { readonly: true });
    const rows = db.prepare('SELECT name, nro_certificado FROM medications ORDER BY name').all() as Array<{
      name: string;
      nro_certificado: string;
    }>;
    expect(rows).toEqual([
      { name: 'Actron', nro_certificado: '55.123' },
      { name: 'Paracetamol Genérico', nro_certificado: '60.001' },
    ]);

    const ftsMatch = db
      .prepare(`SELECT m.name FROM medications_fts f JOIN medications m ON m.rowid = f.rowid WHERE medications_fts MATCH 'actron*'`)
      .all();
    expect(ftsMatch).toEqual([{ name: 'Actron' }]);
    db.close();
  }, 20_000);

  it('correr el script dos veces sobre el mismo CSV es idempotente (upsert por id determinístico)', () => {
    dir = mkdtempSync(join(tmpdir(), 'anmat-test-'));
    const csvPath = join(dir, 'sample.csv');
    const dbPath = join(dir, 'test.db');
    writeFileSync(csvPath, SAMPLE_CSV, 'utf-8');

    runScript(['--input', csvPath, '--db', dbPath]);
    runScript(['--input', csvPath, '--db', dbPath]);

    const db = new Database(dbPath, { readonly: true });
    const count = db.prepare('SELECT COUNT(*) as c FROM medications').get() as { c: number };
    expect(count.c).toBe(2);
    db.close();
  }, 20_000);

  it('--dry-run no escribe filas en medications', () => {
    dir = mkdtempSync(join(tmpdir(), 'anmat-test-'));
    const csvPath = join(dir, 'sample.csv');
    const dbPath = join(dir, 'test.db');
    writeFileSync(csvPath, SAMPLE_CSV, 'utf-8');

    const { stdout, status } = runScript(['--input', csvPath, '--db', dbPath, '--dry-run']);
    expect(status).toBe(0);
    expect(stdout).toContain('[dry-run] No se escribió nada en la DB.');

    const db = new Database(dbPath, { readonly: true });
    const count = db.prepare('SELECT COUNT(*) as c FROM medications').get() as { c: number };
    expect(count.c).toBe(0);
    db.close();
  }, 20_000);

  it('falla con código de salida distinto de 0 si falta --input', () => {
    const { status } = runScript(['--db', './nunca-se-crea.db']);
    expect(status).not.toBe(0);
  }, 20_000);
});
