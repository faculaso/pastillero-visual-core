import { describe, it, expect } from 'vitest';
import { createTestDb } from './test-db';
import { SqliteMedicationCatalogRepository } from '../../src/infrastructure/persistence/sqlite/repositories/sqlite-medication-catalog.repository';
import { buildMedication } from '../support/fixtures';
import type { AnmatMedicationRecord } from '../../src/infrastructure/persistence/sqlite/anmat/anmat-record.mapper';

function buildAnmatRecord(overrides: Partial<AnmatMedicationRecord> = {}): AnmatMedicationRecord {
  return {
    id: 'anmat-1',
    nroCertificado: '55.123',
    nombreComercial: 'Actron',
    genericoDroga: 'Ibuprofeno',
    formaFarmaceutica: 'COMPRIMIDOS RECUBIERTOS',
    concentracion: '400 MG',
    presentacionUnidades: 'ENVASE X 10 COMPRIMIDOS',
    laboratorio: 'Bayer',
    presentationDisplay: 'Comprimidos Recubiertos 400 Mg — Envase X 10 Comprimidos',
    ...overrides,
  };
}

describe('SqliteMedicationCatalogRepository — búsqueda enriquecida (ANMAT)', () => {
  it('searchByText usa FTS5 por defecto (build de better-sqlite3 lo trae compilado) y soporta prefix-match', async () => {
    const { context } = await createTestDb();
    const repo = new SqliteMedicationCatalogRepository(context);
    await repo.upsert(buildMedication({ id: 'm1', name: 'Paracetamol 500', activeIngredient: 'Paracetamol' }));
    await repo.upsert(buildMedication({ id: 'm2', name: 'Ibuprofeno 400', activeIngredient: 'Ibuprofeno' }));

    const result = await repo.searchByText('parac'); // prefijo, no palabra completa
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.map((m) => m.id)).toEqual(['m1']);
  });

  it('búsqueda multi-palabra: AND implícito entre tokens', async () => {
    const { context } = await createTestDb();
    const repo = new SqliteMedicationCatalogRepository(context);
    await repo.upsert(buildMedication({ id: 'm1', name: 'Ibuprofeno 400mg', activeIngredient: 'Ibuprofeno' }));
    await repo.upsert(buildMedication({ id: 'm2', name: 'Ibuprofeno 600mg', activeIngredient: 'Ibuprofeno' }));

    const result = await repo.searchByText('ibuprofeno 600');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.map((m) => m.id)).toEqual(['m2']);
  });

  it('query vacía retorna [] sin tocar la DB', async () => {
    const { context } = await createTestDb();
    const repo = new SqliteMedicationCatalogRepository(context);
    const result = await repo.searchByText('   ');
    expect(result).toEqual({ ok: true, value: [] });
  });

  it('cae a LIKE cuando FTS5 no está disponible en el build, sin romper la búsqueda', async () => {
    const { context } = await createTestDb();
    const repo = new SqliteMedicationCatalogRepository(context);

    // Forzamos la detección de capacidad a fallar (simula un build sin FTS5).
    const originalExecutor = context.getExecutor();
    const originalQueryOne = originalExecutor.queryOne.bind(originalExecutor);
    originalExecutor.queryOne = (async (sql: string, params?: readonly unknown[]) => {
      if (sql.includes('pragma_compile_options')) throw new Error('no fts5 module');
      return originalQueryOne(sql, params);
    }) as typeof originalExecutor.queryOne;

    await repo.upsert(buildMedication({ id: 'm1', name: 'Paracetamol', activeIngredient: 'Paracetamol' }));

    const result = await repo.searchByText('paracet');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.map((m) => m.id)).toEqual(['m1']);
  });

  it('upsertAnmatRecord persiste las columnas oficiales y siguen siendo buscables por FTS5', async () => {
    const { context } = await createTestDb();
    const repo = new SqliteMedicationCatalogRepository(context);

    const upsertResult = await repo.upsertAnmatRecord(buildAnmatRecord());
    expect(upsertResult.ok).toBe(true);

    const found = await repo.findById('anmat-1');
    expect(found.ok).toBe(true);
    if (found.ok && found.value) {
      expect(found.value.name).toBe('Actron');
      expect(found.value.activeIngredient).toBe('Ibuprofeno');
      expect(found.value.laboratory).toBe('Bayer');
      expect(found.value.presentation).toContain('Comprimidos Recubiertos');
    }

    const searchResult = await repo.searchByText('actron');
    expect(searchResult.ok).toBe(true);
    if (searchResult.ok) expect(searchResult.value.map((m) => m.id)).toEqual(['anmat-1']);

    const rawRow = await context
      .getExecutor()
      .queryOne<{ nro_certificado: string; forma_farmaceutica: string }>(
        `SELECT nro_certificado, forma_farmaceutica FROM medications WHERE id = 'anmat-1'`,
      );
    expect(rawRow?.nro_certificado).toBe('55.123');
    expect(rawRow?.forma_farmaceutica).toBe('COMPRIMIDOS RECUBIERTOS');
  });

  it('upsertAnmatRecord es idempotente: reingestar el mismo id actualiza, no duplica', async () => {
    const { context } = await createTestDb();
    const repo = new SqliteMedicationCatalogRepository(context);

    await repo.upsertAnmatRecord(buildAnmatRecord({ nombreComercial: 'Actron Viejo' }));
    await repo.upsertAnmatRecord(buildAnmatRecord({ nombreComercial: 'Actron Nuevo' }));

    const all = await context.getExecutor().queryAll(`SELECT * FROM medications WHERE id = 'anmat-1'`);
    expect(all).toHaveLength(1);

    const found = await repo.findById('anmat-1');
    if (found.ok) expect(found.value?.name).toBe('Actron Nuevo');
  });
});
