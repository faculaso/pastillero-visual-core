import type { SQLiteDatabase, SQLiteRow } from './sqlite-executor.port';

/**
 * Umbral para decidir si el catálogo local está "vacío/de prueba" y hay que
 * reimportarlo desde el asset embebido. 1000 es deliberadamente muy por
 * debajo del tamaño real del Vademécum (~16k registros) pero muy por
 * arriba de cualquier semilla de prueba manual — no hay versión explícita
 * del catálogo todavía, esto es la heurística más simple que resuelve el
 * caso real (dispositivo con 5 medicamentos de muestra hardcodeados).
 */
const STALE_THRESHOLD = 1000;
const BATCH_SIZE = 500;

interface CatalogRow extends SQLiteRow {
  readonly id: string;
  readonly name: string;
  readonly active_ingredient: string;
  readonly laboratory: string;
  readonly presentation: string;
  readonly barcode: string | null;
  readonly synced_at: string | null;
  readonly nro_certificado: string | null;
  readonly forma_farmaceutica: string | null;
  readonly concentracion: string | null;
  readonly presentacion_unidades: string | null;
}

/**
 * Si el catálogo local (`medications`) todavía está por debajo de
 * `STALE_THRESHOLD`, copia todas las filas de `catalogDb` (conexión al
 * `.db` embebido como asset, ya movido a filesystem vía
 * `moveAssetsDatabase` — ver `bootstrap.ts`) hacia `mainDb`, en lotes
 * transaccionales del mismo tamaño que usa `scripts/seed-anmat-catalog.ts`.
 * Upsert por `id`: no rompe si el catálogo embebido y el local se solapan.
 */
export async function importBundledCatalogIfStale(
  mainDb: SQLiteDatabase,
  catalogDb: SQLiteDatabase,
): Promise<void> {
  const current = await mainDb.queryOne<{ readonly c: number }>('SELECT COUNT(*) as c FROM medications');
  if ((current?.c ?? 0) >= STALE_THRESHOLD) return;

  const rows = await catalogDb.queryAll<CatalogRow>('SELECT * FROM medications');

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    await mainDb.transaction(async (tx) => {
      for (const row of batch) {
        await tx.execute(
          `INSERT INTO medications (
             id, name, active_ingredient, laboratory, presentation, barcode, synced_at,
             nro_certificado, forma_farmaceutica, concentracion, presentacion_unidades
           ) VALUES (?,?,?,?,?,?,?,?,?,?,?)
           ON CONFLICT(id) DO UPDATE SET
             name = excluded.name,
             active_ingredient = excluded.active_ingredient,
             laboratory = excluded.laboratory,
             presentation = excluded.presentation,
             barcode = excluded.barcode,
             synced_at = excluded.synced_at,
             nro_certificado = excluded.nro_certificado,
             forma_farmaceutica = excluded.forma_farmaceutica,
             concentracion = excluded.concentracion,
             presentacion_unidades = excluded.presentacion_unidades`,
          [
            row.id,
            row.name,
            row.active_ingredient,
            row.laboratory,
            row.presentation,
            row.barcode,
            row.synced_at,
            row.nro_certificado,
            row.forma_farmaceutica,
            row.concentracion,
            row.presentacion_unidades,
          ],
        );
      }
    });
  }
}
