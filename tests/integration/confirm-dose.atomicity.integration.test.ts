import { describe, it, expect } from 'vitest';
import { createTestDb } from './test-db';
import { seedTreatment } from './seed';
import { SqliteTreatmentRepository } from '../../src/infrastructure/persistence/sqlite/repositories/sqlite-treatment.repository';
import { SqliteDoseRepository } from '../../src/infrastructure/persistence/sqlite/repositories/sqlite-dose.repository';
import { ConfirmDoseUseCase } from '../../src/application';
import { DoseStatus, MeasurementUnit } from '../../src/domain';
import { FakeClock } from '../support/fakes';
import { buildDose } from '../support/fixtures';

/**
 * Este es el test que valida la PIEZA CLAVE del diseño: que
 * `DoseRepository.confirmDoseWithStockDecrement` ejecuta una transacción SQL
 * real (BEGIN/COMMIT/ROLLBACK) contra SQLite, no solo una abstracción de la
 * aplicación — y que un guard que falla hace ROLLBACK de TODO, incluida la
 * actualización de `doses` que ya se había escrito contra `tx` antes de
 * llegar a ese guard.
 */
describe('DoseRepository.confirmDoseWithStockDecrement — atomicidad real contra SQLite (better-sqlite3)', () => {
  it('confirma la toma y decrementa el stock en una única transacción exitosa', async () => {
    const { context } = await createTestDb();
    await seedTreatment(context, {
      treatment: { id: 't1', stock: { currentQuantity: 10, dailyConsumption: 1, unit: MeasurementUnit.UNIT, criticalThresholdDays: 3 } },
    });

    const doseRepo = new SqliteDoseRepository(context);
    await doseRepo.createSlots([buildDose({ id: 'd1', treatmentId: 't1' })]);

    const treatmentRepo = new SqliteTreatmentRepository(context);
    const useCase = new ConfirmDoseUseCase(
      doseRepo,
      treatmentRepo,
      new FakeClock(new Date('2026-08-01T08:05:00.000Z')),
    );

    const result = await useCase.execute({ doseId: 'd1', requestingPatientId: 'patient-1' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.dose.status).toBe(DoseStatus.TAKEN);
    expect(result.value.stock.currentQuantity).toBe(9);

    // Verificación directa contra la fila real, fuera del use case.
    const doseRow = await context.getExecutor().queryOne<{ status: string }>(
      `SELECT status FROM doses WHERE id = 'd1'`,
    );
    const stockRow = await context.getExecutor().queryOne<{ stock_current_quantity: number }>(
      `SELECT stock_current_quantity FROM treatments WHERE id = 't1'`,
    );
    expect(doseRow?.status).toBe('TAKEN');
    expect(stockRow?.stock_current_quantity).toBe(9);
  });

  /**
   * El stock ya NO es un guard: quedarse sin stock no puede impedir
   * registrar una toma que de verdad ocurrió (ver `decrementStock` y la
   * migración 0007). Este caso, que antes era el de ROLLBACK, ahora prueba
   * lo contrario — que la toma se registra igual.
   */
  it('con el stock en cero la toma SE REGISTRA igual, y el stock no baja de cero', async () => {
    const { context } = await createTestDb();
    await seedTreatment(context, {
      treatment: { id: 't1', stock: { currentQuantity: 0, dailyConsumption: 1, unit: MeasurementUnit.UNIT, criticalThresholdDays: 3 } },
    });

    const doseRepo = new SqliteDoseRepository(context);
    await doseRepo.createSlots([buildDose({ id: 'd1', treatmentId: 't1' })]);

    const result = await doseRepo.confirmDoseWithStockDecrement(
      'd1',
      new Date('2026-08-01T08:05:00.000Z'),
      { amount: 1, unit: MeasurementUnit.UNIT },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.dose.status).toBe(DoseStatus.TAKEN);
      expect(result.value.stock.currentQuantity).toBe(0);
      // La señal de que el inventario del Cuidador está desactualizado.
      expect(result.value.stockWasShort).toBe(true);
    }

    const doseRow = await context.getExecutor().queryOne<{ status: string }>(
      `SELECT status FROM doses WHERE id = 'd1'`,
    );
    const stockRow = await context.getExecutor().queryOne<{ stock_current_quantity: number }>(
      `SELECT stock_current_quantity FROM treatments WHERE id = 't1'`,
    );
    expect(doseRow?.status).toBe('TAKEN');
    expect(stockRow?.stock_current_quantity).toBe(0);
  });

  /**
   * La transacción real sigue siendo la pieza clave del diseño, así que
   * hace falta un guard vivo que la ejercite. El de tratamiento inexistente
   * salta DESPUÉS de que el UPDATE de `doses` ya se escribió contra `tx`,
   * que es exactamente la condición que este test necesita.
   */
  it('ROLLBACK real: si el tratamiento no existe, SQLite revierte también la confirmación ya escrita', async () => {
    const { context } = await createTestDb();
    await seedTreatment(context, { treatment: { id: 't1' } });

    const doseRepo = new SqliteDoseRepository(context);
    await doseRepo.createSlots([buildDose({ id: 'd1', treatmentId: 't1' })]);

    // Se borra el tratamiento dejando la toma huérfana: el UPDATE de `doses`
    // llega a ejecutarse y recién después falla la búsqueda del tratamiento.
    await context.getExecutor().execute(`PRAGMA foreign_keys = OFF`);
    await context.getExecutor().execute(`DELETE FROM treatments WHERE id = 't1'`);

    const result = await doseRepo.confirmDoseWithStockDecrement(
      'd1',
      new Date('2026-08-01T08:05:00.000Z'),
      { amount: 1, unit: MeasurementUnit.UNIT },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('TREATMENT_NOT_FOUND');

    const doseRow = await context.getExecutor().queryOne<{ status: string }>(
      `SELECT status FROM doses WHERE id = 'd1'`,
    );
    expect(doseRow?.status).toBe('PENDING');
  });
});
