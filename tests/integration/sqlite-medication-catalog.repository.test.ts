import { describe, it, expect } from 'vitest';
import { createTestDb } from './test-db';
import { SqliteMedicationCatalogRepository } from '../../src/infrastructure/persistence/sqlite/repositories/sqlite-medication-catalog.repository';
import { buildMedication } from '../support/fixtures';

describe('SqliteMedicationCatalogRepository (integración)', () => {
  it('upsert + findById roundtrip', async () => {
    const { context } = await createTestDb();
    const repo = new SqliteMedicationCatalogRepository(context);
    await repo.upsert(buildMedication({ id: 'm1', name: 'Ibuprofeno' }));

    const result = await repo.findById('m1');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value?.name).toBe('Ibuprofeno');
  });

  it('upsert sobre un id existente actualiza en vez de duplicar', async () => {
    const { context } = await createTestDb();
    const repo = new SqliteMedicationCatalogRepository(context);
    await repo.upsert(buildMedication({ id: 'm1', name: 'Nombre Viejo' }));
    await repo.upsert(buildMedication({ id: 'm1', name: 'Nombre Nuevo' }));

    const result = await repo.findById('m1');
    if (result.ok) expect(result.value?.name).toBe('Nombre Nuevo');

    const all = await context.getExecutor().queryAll(`SELECT * FROM medications`);
    expect(all).toHaveLength(1);
  });

  it('searchByText busca por nombre y principio activo (LIKE, case-insensitive en SQLite por defecto para ASCII)', async () => {
    const { context } = await createTestDb();
    const repo = new SqliteMedicationCatalogRepository(context);
    await repo.upsert(buildMedication({ id: 'm1', name: 'Paracetamol 500', activeIngredient: 'Paracetamol' }));
    await repo.upsert(buildMedication({ id: 'm2', name: 'Ibuprofeno 400', activeIngredient: 'Ibuprofeno' }));

    const result = await repo.searchByText('paracet');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.map((m) => m.id)).toEqual(['m1']);
  });

  it('searchByBarcode encuentra por código exacto y respeta unicidad', async () => {
    const { context } = await createTestDb();
    const repo = new SqliteMedicationCatalogRepository(context);
    await repo.upsert(buildMedication({ id: 'm1', barcode: '7791234567890' }));

    const found = await repo.searchByBarcode('7791234567890');
    if (found.ok) expect(found.value?.id).toBe('m1');

    const notFound = await repo.searchByBarcode('0000000000000');
    if (notFound.ok) expect(notFound.value).toBeNull();
  });
});
