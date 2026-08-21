import type { Result, DomainError } from '../../domain';
import type { UseCase } from '../core/use-case';
import type { MedicationVisualSuggestionProvider } from '../ports/medication-visual-suggestion.port';
import type { SuggestVisualProfileInput, SuggestVisualProfileOutput } from '../dto/suggest-visual-profile.dto';

/**
 * Autocompletado del paso 6-7 de CU-01 ("El sistema despliega el
 * configurador visual"): al seleccionar un medicamento del catálogo, sugiere
 * forma/ranura/stock inicial en vez de arrancar el formulario en blanco.
 * Es SIEMPRE una sugerencia editable — nunca bloquea el alta si no hay
 * datos ANMAT suficientes (`suggestion: null` es un resultado válido, no
 * un error).
 */
export class SuggestVisualProfileUseCase
  implements UseCase<SuggestVisualProfileInput, SuggestVisualProfileOutput>
{
  constructor(private readonly provider: MedicationVisualSuggestionProvider) {}

  async execute(
    input: SuggestVisualProfileInput,
  ): Promise<Result<SuggestVisualProfileOutput, DomainError>> {
    const result = await this.provider.getSuggestion(input.medicationId);
    if (!result.ok) return result;
    return { ok: true, value: { suggestion: result.value } };
  }
}
