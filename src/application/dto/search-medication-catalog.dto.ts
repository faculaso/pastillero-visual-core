import type { Medication } from '../../domain';

export interface SearchMedicationCatalogInput {
  /** Texto libre (nombre/principio activo) o código de barras escaneado. */
  readonly query: string;
  /**
   * Ignora `query` y lista medicamentos del catálogo directamente (orden
   * alfabético) — permite mostrar resultados sin que el Cuidador tenga que
   * escribir nada primero.
   */
  readonly browseAll?: boolean;
}

export interface SearchMedicationCatalogOutput {
  readonly medications: readonly Medication[];
}
