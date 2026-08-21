import { describe, it, expect } from 'vitest';
import { createTestDb } from './test-db';
import { SqliteMedicationCatalogRepository } from '../../src/infrastructure/persistence/sqlite/repositories/sqlite-medication-catalog.repository';
import { SqliteMedicationVisualSuggestionProvider } from '../../src/infrastructure/persistence/sqlite/repositories/sqlite-medication-visual-suggestion.provider';
import { buildMedication } from '../support/fixtures';
import { PillShape, MeasurementUnit } from '../../src/domain';
import type { AnmatMedicationRecord } from '../../src/infrastructure/persistence/sqlite/anmat/anmat-record.mapper';

function buildAnmatRecord(overrides: Partial<AnmatMedicationRecord> = {}): AnmatMedicationRecord {
  return {
    id: 'anmat-1',
    nroCertificado: '55.123',
    nombreComercial: 'Actron',
    genericoDroga: 'Ibuprofeno',
    formaFarmaceutica: 'CAPSULAS BLANDAS',
    concentracion: '400 MG',
    presentacionUnidades: 'ENVASE X 20 CAPSULAS',
    laboratorio: 'Bayer',
    presentationDisplay: 'Capsulas Blandas 400 Mg — Envase X 20 Capsulas',
    ...overrides,
  };
}

describe('SqliteMedicationVisualSuggestionProvider (integración)', () => {
  it('sugiere shape/slotLabel/stock a partir de las columnas ANMAT reales', async () => {
    const { context } = await createTestDb();
    await new SqliteMedicationCatalogRepository(context).upsertAnmatRecord(buildAnmatRecord());
    const provider = new SqliteMedicationVisualSuggestionProvider(context);

    const result = await provider.getSuggestion('anmat-1');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({
      shape: PillShape.CAPSULE,
      slotLabel: '400 MG',
      suggestedStock: { quantity: 20, unit: MeasurementUnit.UNIT },
    });
  });

  it('retorna null cuando el medicamento no tiene ningún dato ANMAT (cargado manualmente)', async () => {
    const { context } = await createTestDb();
    await new SqliteMedicationCatalogRepository(context).upsert(buildMedication({ id: 'manual-1' }));
    const provider = new SqliteMedicationVisualSuggestionProvider(context);

    const result = await provider.getSuggestion('manual-1');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBeNull();
  });

  it('retorna error si el medicamento no existe', async () => {
    const { context } = await createTestDb();
    const provider = new SqliteMedicationVisualSuggestionProvider(context);

    const result = await provider.getSuggestion('no-existe');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('MEDICATION_NOT_FOUND');
  });
});
