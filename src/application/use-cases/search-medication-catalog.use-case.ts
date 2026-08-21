import { Ok, type Result, type DomainError, type MedicationCatalogRepository } from '../../domain';
import type { UseCase } from '../core/use-case';
import type { SearchMedicationCatalogInput, SearchMedicationCatalogOutput } from '../dto/search-medication-catalog.dto';

const BARCODE_PATTERN = /^\d{8,14}$/; // EAN-8/EAN-13/UPC típicos

/**
 * CU-01 pasos 2-5: el Cuidador "ingresa el texto o escanea el envase" — un
 * único campo de entrada para ambos casos. Se resuelve con una heurística
 * simple: si el input es solo dígitos y tiene longitud de código de barras
 * típico, se interpreta como barcode; si no, búsqueda de texto libre.
 */
export class SearchMedicationCatalogUseCase
  implements UseCase<SearchMedicationCatalogInput, SearchMedicationCatalogOutput>
{
  constructor(private readonly medicationCatalogRepository: MedicationCatalogRepository) {}

  async execute(
    input: SearchMedicationCatalogInput,
  ): Promise<Result<SearchMedicationCatalogOutput, DomainError>> {
    const trimmed = input.query.trim();
    if (trimmed.length === 0) return Ok({ medications: [] });

    if (BARCODE_PATTERN.test(trimmed)) {
      const result = await this.medicationCatalogRepository.searchByBarcode(trimmed);
      if (!result.ok) return result;
      return Ok({ medications: result.value ? [result.value] : [] });
    }

    const result = await this.medicationCatalogRepository.searchByText(trimmed);
    if (!result.ok) return result;
    return Ok({ medications: result.value });
  }
}
