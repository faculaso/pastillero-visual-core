import type { Medication } from '../../domain';

export interface SearchMedicationCatalogInput {
  /** Texto libre (nombre/principio activo) o código de barras escaneado. */
  readonly query: string;
}

export interface SearchMedicationCatalogOutput {
  readonly medications: readonly Medication[];
}
