import { describe, it, expect } from 'vitest';
import { SuggestVisualProfileUseCase } from '../../../src/application';
import { Ok, Err, DomainErrors, PillShape, MeasurementUnit } from '../../../src/domain';
import type { MedicationVisualSuggestionProvider } from '../../../src/application';

describe('SuggestVisualProfileUseCase', () => {
  it('retorna la sugerencia del provider tal cual', async () => {
    const provider: MedicationVisualSuggestionProvider = {
      getSuggestion: async () =>
        Ok({ shape: PillShape.CAPSULE, slotLabel: '400 MG', suggestedStock: { quantity: 10, unit: MeasurementUnit.UNIT } }),
    };
    const useCase = new SuggestVisualProfileUseCase(provider);

    const result = await useCase.execute({ medicationId: 'med-1' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.suggestion?.shape).toBe(PillShape.CAPSULE);
      expect(result.value.suggestion?.suggestedStock?.quantity).toBe(10);
    }
  });

  it('propaga suggestion: null cuando el provider no tiene datos ANMAT', async () => {
    const provider: MedicationVisualSuggestionProvider = { getSuggestion: async () => Ok(null) };
    const useCase = new SuggestVisualProfileUseCase(provider);

    const result = await useCase.execute({ medicationId: 'med-1' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.suggestion).toBeNull();
  });

  it('propaga el error del provider', async () => {
    const provider: MedicationVisualSuggestionProvider = {
      getSuggestion: async () => Err(DomainErrors.medicationNotFound('med-1')),
    };
    const useCase = new SuggestVisualProfileUseCase(provider);

    const result = await useCase.execute({ medicationId: 'med-1' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('MEDICATION_NOT_FOUND');
  });
});
