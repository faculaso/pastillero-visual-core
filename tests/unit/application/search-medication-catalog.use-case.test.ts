import { describe, it, expect, beforeEach } from 'vitest';
import { SearchMedicationCatalogUseCase } from '../../../src/application';
import { InMemoryStore, InMemoryMedicationCatalogRepository } from '../../support/in-memory-repos';
import { buildMedication } from '../../support/fixtures';

describe('SearchMedicationCatalogUseCase', () => {
  let store: InMemoryStore;
  let useCase: SearchMedicationCatalogUseCase;

  beforeEach(() => {
    store = new InMemoryStore();
    useCase = new SearchMedicationCatalogUseCase(new InMemoryMedicationCatalogRepository(store));
    store.medications.set('m1', buildMedication({ id: 'm1', name: 'Paracetamol', barcode: '7791234567890' }));
    store.medications.set('m2', buildMedication({ id: 'm2', name: 'Ibuprofeno', activeIngredient: 'Ibuprofeno' }));
  });

  it('busca por texto libre', async () => {
    const result = await useCase.execute({ query: 'parac' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.medications.map((m) => m.id)).toEqual(['m1']);
  });

  it('interpreta un string numérico largo como código de barras', async () => {
    const result = await useCase.execute({ query: '7791234567890' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.medications.map((m) => m.id)).toEqual(['m1']);
  });

  it('retorna vacío para query en blanco sin tocar el repo', async () => {
    const result = await useCase.execute({ query: '   ' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.medications).toEqual([]);
  });

  it('barcode inexistente retorna lista vacía, no error', async () => {
    const result = await useCase.execute({ query: '00000000' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.medications).toEqual([]);
  });
});
