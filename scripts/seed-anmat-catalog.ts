#!/usr/bin/env node
/**
 * seed-anmat-catalog.ts — Ingesta del Vademécum Nacional de Medicamentos
 * (ANMAT) a la caché local SQLite del catálogo.
 *
 * Responsabilidad ÚNICA: parsear un CSV ya descargado e insertarlo/
 * actualizarlo en la DB. Deliberadamente NO hace `fetch` del dataset
 * público — la descarga es un paso aparte (CI, o `curl` manual), separado
 * de la ingesta, para que este script sea testeable y determinístico sin
 * depender de la disponibilidad/formato exacto de un endpoint externo en
 * cada corrida. Coherente con la premisa offline-first: la app nunca
 * descarga el catálogo en runtime, consume el `.db` ya poblado.
 *
 * Uso:
 *   npx tsx scripts/seed-anmat-catalog.ts --input vademecum.csv --db pastillero.db
 *
 * Flags:
 *   --input <path>      Ruta al CSV de ANMAT (requerido).
 *   --db <path>         Ruta al archivo SQLite a crear/actualizar (default: ./pastillero.db).
 *   --delimiter <char>  Delimitador del CSV (default: ';', el que usa datos.gob.ar/ANMAT).
 *   --batch-size <n>    Filas por transacción (default: 500).
 *   --dry-run           Parsea y valida sin escribir en la DB (para revisar el CSV antes de ingestar).
 */
import { readFileSync } from 'node:fs';
import { parse } from 'csv-parse/sync';
// Imports puntuales, NO el barrel `../src/infrastructure`: ese barrel
// re-exporta `bootstrap.ts`, que hace `import { open } from
// '@op-engineering/op-sqlite'` — un import de VALOR real (no de tipo).
// op-sqlite es un módulo nativo JSI que solo existe dentro de React
// Native; importarlo en este script (Node puro, corrido con `tsx`)
// rompería en el momento de cargar el módulo. Importando cada pieza por
// su path concreto, este script nunca toca esa cadena.
import { openBetterSqlite3File } from '../src/infrastructure/persistence/sqlite/adapters/better-sqlite3.adapter';
import { MigrationRunner } from '../src/infrastructure/persistence/sqlite/migration-runner';
import { MIGRATIONS } from '../src/infrastructure/persistence/sqlite/migrations';
import { SqliteTransactionContext } from '../src/infrastructure/persistence/sqlite/sqlite-transaction-context';
import { SqliteMedicationCatalogRepository } from '../src/infrastructure/persistence/sqlite/repositories/sqlite-medication-catalog.repository';
import { parseAnmatCsvRow, type AnmatCsvRow, type AnmatMedicationRecord } from '../src/infrastructure/persistence/sqlite/anmat';

interface CliOptions {
  readonly input: string;
  readonly dbPath: string;
  readonly delimiter: string;
  readonly batchSize: number;
  readonly dryRun: boolean;
}

function parseCliArgs(argv: readonly string[]): CliOptions {
  const get = (flag: string): string | undefined => {
    const index = argv.indexOf(flag);
    return index >= 0 ? argv[index + 1] : undefined;
  };

  const input = get('--input');
  if (!input) {
    throw new Error('Falta --input <path-al-csv-de-anmat>');
  }

  return {
    input,
    dbPath: get('--db') ?? './pastillero.db',
    delimiter: get('--delimiter') ?? ';',
    batchSize: Number(get('--batch-size') ?? '500'),
    dryRun: argv.includes('--dry-run'),
  };
}

interface IngestSummary {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  written: number;
  errors: number;
}

function readAndParseCsv(path: string, delimiter: string): readonly AnmatCsvRow[] {
  // El dataset abierto de ANMAT suele traer BOM UTF-8; se lo descarta si está presente.
  const raw = readFileSync(path, 'utf-8').replace(/^\uFEFF/, '');
  return parse(raw, {
    columns: (header: string[]) => header.map((h) => h.trim().toLowerCase().replace(/\s+/g, '_')),
    delimiter,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true, // el dataset real tiene filas con columnas de más/menos ocasionalmente
  }) as AnmatCsvRow[];
}

function mapValidRows(rows: readonly AnmatCsvRow[], summary: IngestSummary): AnmatMedicationRecord[] {
  const records: AnmatMedicationRecord[] = [];
  for (const row of rows) {
    const result = parseAnmatCsvRow(row);
    if (!result.ok) {
      summary.invalidRows += 1;
      continue;
    }
    summary.validRows += 1;
    records.push(result.value);
  }
  return records;
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function ingest(records: readonly AnmatMedicationRecord[], options: CliOptions, summary: IngestSummary): Promise<void> {
  const db = openBetterSqlite3File(options.dbPath);
  try {
    await new MigrationRunner(db).applyAll(MIGRATIONS);

    if (options.dryRun) {
      console.log('[dry-run] No se escribió nada en la DB.');
      return;
    }

    const context = new SqliteTransactionContext(db);
    const repository = new SqliteMedicationCatalogRepository(context);
    const batches = chunk(records, options.batchSize);

    for (const [index, batch] of batches.entries()) {
      const result = await context.runInTransaction(async () => {
        for (const record of batch) {
          const upsertResult = await repository.upsertAnmatRecord(record);
          if (!upsertResult.ok) {
            summary.errors += 1;
            console.error(`  ✗ ${record.nombreComercial} (${record.id}): ${upsertResult.error.message}`);
            continue;
          }
          summary.written += 1;
        }
      });
      void result;
      console.log(`  lote ${index + 1}/${batches.length} (${batch.length} filas) — OK`);
    }
  } finally {
    db.close();
  }
}

async function main(): Promise<void> {
  const options = parseCliArgs(process.argv.slice(2));
  const summary: IngestSummary = { totalRows: 0, validRows: 0, invalidRows: 0, written: 0, errors: 0 };

  console.log(`Leyendo ${options.input} (delimitador "${options.delimiter}")...`);
  const rawRows = readAndParseCsv(options.input, options.delimiter);
  summary.totalRows = rawRows.length;

  const records = mapValidRows(rawRows, summary);
  console.log(`Filas leídas: ${summary.totalRows} — válidas: ${summary.validRows} — inválidas: ${summary.invalidRows}`);

  if (records.length === 0) {
    console.log('Nada para ingestar.');
    return;
  }

  console.log(`Escribiendo en ${options.dbPath}${options.dryRun ? ' (dry-run)' : ''}...`);
  await ingest(records, options, summary);

  console.log('\n— Resumen —');
  console.log(`  Filas totales:   ${summary.totalRows}`);
  console.log(`  Válidas:         ${summary.validRows}`);
  console.log(`  Inválidas:       ${summary.invalidRows}`);
  console.log(`  Escritas (OK):   ${summary.written}`);
  console.log(`  Errores de escritura: ${summary.errors}`);

  if (summary.errors > 0) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error('Falló la ingesta:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
