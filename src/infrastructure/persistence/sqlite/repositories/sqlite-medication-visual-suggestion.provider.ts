import { Ok, Err, type Result, DomainErrors, type DomainError } from '../../../../domain';
import type { MedicationVisualSuggestionProvider, VisualProfileSuggestion } from '../../../../application';
import type { SqliteTransactionContext } from '../sqlite-transaction-context';
import type { SQLiteRow } from '../sqlite-executor.port';
import { mapFormaFarmaceuticaToPillShape } from '../anmat/pill-shape.mapper';
import { suggestInitialStockFromPresentacion } from '../anmat/stock-suggestion.mapper';

interface AnmatFieldsRow extends SQLiteRow {
  readonly forma_farmaceutica: string | null;
  readonly presentacion_unidades: string | null;
  readonly concentracion: string | null;
}

/**
 * Lee las columnas ANMAT crudas (fuera del `Medication` de dominio, ver
 * el puerto) y las traduce a una sugerencia de perfil visual usando los
 * mappers puros de `anmat/`. Si el medicamento no tiene datos ANMAT (fue
 * cargado manualmente, o el catálogo local no llegó a sincronizarse),
 * retorna `null` — nunca inventa una sugerencia sin base.
 */
export class SqliteMedicationVisualSuggestionProvider implements MedicationVisualSuggestionProvider {
  constructor(private readonly context: SqliteTransactionContext) {}

  async getSuggestion(medicationId: string): Promise<Result<VisualProfileSuggestion | null, DomainError>> {
    try {
      const row = await this.context.getExecutor().queryOne<AnmatFieldsRow>(
        `SELECT forma_farmaceutica, presentacion_unidades, concentracion FROM medications WHERE id = ?`,
        [medicationId],
      );
      if (!row) return Err(DomainErrors.medicationNotFound(medicationId));

      const hasAnyAnmatField = Boolean(row.forma_farmaceutica || row.presentacion_unidades || row.concentracion);
      if (!hasAnyAnmatField) return Ok(null);

      const shape = mapFormaFarmaceuticaToPillShape(row.forma_farmaceutica);
      const suggestedStock = suggestInitialStockFromPresentacion(row.presentacion_unidades) ?? undefined;
      const slotLabel = row.concentracion?.trim() || undefined;

      return Ok({ shape, slotLabel, suggestedStock });
    } catch (cause) {
      return Err(DomainErrors.repositoryFailure(cause));
    }
  }
}
