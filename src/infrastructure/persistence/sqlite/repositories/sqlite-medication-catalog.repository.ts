import { Ok, Err, type Result, DomainErrors, type DomainError } from '../../../../domain';
import type { Medication, MedicationCatalogRepository } from '../../../../domain';
import type { SqliteTransactionContext } from '../sqlite-transaction-context';
import { mapRowToMedication, type MedicationRow } from '../mappers/dose-medication.mapper';
import type { AnmatMedicationRecord } from '../anmat/anmat-record.mapper';

/**
 * Implementa el puerto contra la caché LOCAL (tabla `medications`). La
 * descarga del CSV de ANMAT es responsabilidad de `scripts/seed-anmat-catalog.ts`
 * (offline, en build/CI) — este repo solo lee/escribe la caché ya poblada,
 * nunca hace fetch HTTP (premisa offline-first: la app no depende de red
 * para buscar un medicamento).
 *
 * Búsqueda: intenta FTS5 (`medications_fts`, ver migración 002) y cae a
 * `LIKE` sobre columnas indexadas (COLLATE NOCASE) si el build de SQLite no
 * trae el módulo FTS5 compilado. La detección se hace una vez por instancia
 * y se cachea — evita repetir la query de capability-check en cada búsqueda.
 */
export class SqliteMedicationCatalogRepository implements MedicationCatalogRepository {
  private fts5AvailablePromise: Promise<boolean> | null = null;

  constructor(private readonly context: SqliteTransactionContext) {}

  async searchByText(query: string): Promise<Result<readonly Medication[], DomainError>> {
    const trimmed = query.trim();
    if (trimmed.length === 0) return Ok([]);

    try {
      const useFts5 = await this.isFts5Available();
      const rows = useFts5 ? await this.searchViaFts5(trimmed) : await this.searchViaLike(trimmed);
      return Ok(rows.map(mapRowToMedication));
    } catch (cause) {
      return Err(DomainErrors.repositoryFailure(cause));
    }
  }

  async listAll(limit = 50): Promise<Result<readonly Medication[], DomainError>> {
    try {
      const rows = await this.context
        .getExecutor()
        .queryAll<MedicationRow>(`SELECT * FROM medications ORDER BY name ASC LIMIT ?`, [limit]);
      return Ok(rows.map(mapRowToMedication));
    } catch (cause) {
      return Err(DomainErrors.repositoryFailure(cause));
    }
  }

  async searchByBarcode(barcode: string): Promise<Result<Medication | null, DomainError>> {
    try {
      const row = await this.context
        .getExecutor()
        .queryOne<MedicationRow>(`SELECT * FROM medications WHERE barcode = ?`, [barcode]);
      return Ok(row ? mapRowToMedication(row) : null);
    } catch (cause) {
      return Err(DomainErrors.repositoryFailure(cause));
    }
  }

  async findById(id: string): Promise<Result<Medication | null, DomainError>> {
    try {
      const row = await this.context
        .getExecutor()
        .queryOne<MedicationRow>(`SELECT * FROM medications WHERE id = ?`, [id]);
      return Ok(row ? mapRowToMedication(row) : null);
    } catch (cause) {
      return Err(DomainErrors.repositoryFailure(cause));
    }
  }

  /** Upsert usado por el servicio de sincronización remota (fuera de este repo) para poblar la caché. */
  async upsert(medication: Medication): Promise<Result<void, DomainError>> {
    try {
      await this.context.getExecutor().execute(
        `INSERT INTO medications (id, name, active_ingredient, laboratory, presentation, barcode, synced_at)
         VALUES (?,?,?,?,?,?, datetime('now'))
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           active_ingredient = excluded.active_ingredient,
           laboratory = excluded.laboratory,
           presentation = excluded.presentation,
           barcode = excluded.barcode,
           synced_at = excluded.synced_at`,
        [
          medication.id,
          medication.name,
          medication.activeIngredient,
          medication.laboratory,
          medication.presentation,
          medication.barcode ?? null,
        ],
      );
      return Ok(undefined);
    } catch (cause) {
      return Err(DomainErrors.repositoryFailure(cause));
    }
  }

  /**
   * Upsert de un registro ANMAT completo (incluye las columnas oficiales
   * además de las genéricas de dominio). NO es parte del contrato
   * `MedicationCatalogRepository` — el dominio no conoce estas columnas
   * (ver `anmat-record.mapper.ts`). Es una "escotilla" de la clase
   * concreta, usada solo por `scripts/seed-anmat-catalog.ts` y por
   * `SqliteMedicationVisualSuggestionProvider` para leer estos campos.
   */
  async upsertAnmatRecord(record: AnmatMedicationRecord): Promise<Result<void, DomainError>> {
    try {
      await this.context.getExecutor().execute(
        `INSERT INTO medications (
           id, name, active_ingredient, laboratory, presentation,
           nro_certificado, forma_farmaceutica, concentracion, presentacion_unidades,
           synced_at
         ) VALUES (?,?,?,?,?, ?,?,?,?, datetime('now'))
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           active_ingredient = excluded.active_ingredient,
           laboratory = excluded.laboratory,
           presentation = excluded.presentation,
           nro_certificado = excluded.nro_certificado,
           forma_farmaceutica = excluded.forma_farmaceutica,
           concentracion = excluded.concentracion,
           presentacion_unidades = excluded.presentacion_unidades,
           synced_at = excluded.synced_at`,
        [
          record.id,
          record.nombreComercial,
          record.genericoDroga,
          record.laboratorio,
          record.presentationDisplay,
          record.nroCertificado,
          record.formaFarmaceutica || null,
          record.concentracion || null,
          record.presentacionUnidades || null,
        ],
      );
      return Ok(undefined);
    } catch (cause) {
      return Err(DomainErrors.repositoryFailure(cause));
    }
  }

  /**
   * Detecta si el build de SQLite en uso tiene FTS5 compilado. Se cachea
   * en una promesa de instancia (no un booleano) para que llamadas
   * concurrentes durante la primera búsqueda no disparen la query de
   * detección más de una vez.
   */
  private isFts5Available(): Promise<boolean> {
    if (!this.fts5AvailablePromise) {
      this.fts5AvailablePromise = this.context
        .getExecutor()
        .queryOne(`SELECT 1 FROM pragma_compile_options WHERE compile_options = 'ENABLE_FTS5' LIMIT 1`)
        .then((row) => row !== null)
        .catch(() => false); // si el driver ni siquiera soporta pragma_compile_options, asumimos que no hay FTS5
    }
    return this.fts5AvailablePromise;
  }

  private async searchViaFts5(query: string): Promise<readonly MedicationRow[]> {
    const matchExpression = buildFts5MatchExpression(query);
    if (!matchExpression) return [];
    return this.context.getExecutor().queryAll<MedicationRow>(
      `SELECT m.* FROM medications_fts f
       JOIN medications m ON m.rowid = f.rowid
       WHERE medications_fts MATCH ?
       ORDER BY rank
       LIMIT 50`,
      [matchExpression],
    );
  }

  private async searchViaLike(query: string): Promise<readonly MedicationRow[]> {
    const like = `%${query}%`;
    return this.context.getExecutor().queryAll<MedicationRow>(
      `SELECT * FROM medications WHERE name LIKE ? OR active_ingredient LIKE ? ORDER BY name ASC LIMIT 50`,
      [like, like],
    );
  }
}

/**
 * Sanitiza el input del usuario para FTS5: se descarta todo excepto
 * letras/números/espacios (evita que comillas, dos puntos, paréntesis,
 * etc. rompan la sintaxis de `MATCH`), se tokeniza por palabra y cada
 * token se vuelve un prefix-match (`termino*`). Tokens unidos con espacio
 * = AND implícito de FTS5: "para 500" solo matchea filas con AMBOS
 * prefijos, en cualquiera de las dos columnas indexadas.
 */
function buildFts5MatchExpression(query: string): string | null {
  const sanitized = query.replace(/[^\p{L}\p{N}\s]/gu, ' ').trim();
  if (sanitized.length === 0) return null;

  const tokens = sanitized.split(/\s+/).filter((t) => t.length > 0);
  if (tokens.length === 0) return null;

  return tokens.map((t) => `${t}*`).join(' ');
}
