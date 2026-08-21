import type { SqliteTransactionContext } from '../../src/infrastructure/persistence/sqlite/sqlite-transaction-context';
import { SqliteMedicationCatalogRepository } from '../../src/infrastructure/persistence/sqlite/repositories/sqlite-medication-catalog.repository';
import { SqliteTreatmentRepository } from '../../src/infrastructure/persistence/sqlite/repositories/sqlite-treatment.repository';
import { buildMedication, buildTreatment } from '../support/fixtures';
import type { Treatment, Medication } from '../../src/domain';

/** Inserta solo la medication (para satisfacer la FK) sin crear ningún treatment. */
export async function seedMedication(
  context: SqliteTransactionContext,
  overrides: Partial<Medication> = {},
): Promise<Medication> {
  const medicationRepo = new SqliteMedicationCatalogRepository(context);
  const medication = buildMedication(overrides);
  await medicationRepo.upsert(medication);
  return medication;
}

/** Inserta una medication + treatment válidos vía los repos reales (no SQL crudo) y los devuelve. */
export async function seedTreatment(
  context: SqliteTransactionContext,
  overrides: { medication?: Partial<Medication>; treatment?: Partial<Treatment> } = {},
): Promise<Treatment> {
  const medication = await seedMedication(context, overrides.medication);

  const treatmentRepo = new SqliteTreatmentRepository(context);
  const treatment = buildTreatment({ medication, ...overrides.treatment });
  const result = await treatmentRepo.create(treatment);
  if (!result.ok) throw new Error(`seed falló: ${result.error.message}`);
  return result.value;
}
