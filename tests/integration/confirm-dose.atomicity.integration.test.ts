import { describe, it, expect } from 'vitest';
import { createTestDb } from './test-db';
import { seedTreatment } from './seed';
import { SqliteTreatmentRepository } from '../../src/infrastructure/persistence/sqlite/repositories/sqlite-treatment.repository';
import { SqliteDoseRepository } from '../../src/infrastructure/persistence/sqlite/repositories/sqlite-dose.repository';
import { SqliteStockRepository } from '../../src/infrastructure/persistence/sqlite/repositories/sqlite-stock.repository';
import { ConfirmDoseUseCase } from '../../src/application';
import { DoseStatus, MeasurementUnit } from '../../src/domain';
import { FakeClock } from '../support/fakes';
import { buildDose } from '../support/fixtures';

/**
 * Este es el test que valida la PIEZA CLAVE del diseño: que
 * `SqliteTransactionContext` + `SqliteTransactionRunner` producen una
 * transacción SQL real (BEGIN/COMMIT/ROLLBACK), no solo una abstracción de
 * la aplicación. Forzamos un fallo real después de que `confirmDose` ya
 * escribió en la conexión `tx`, y verificamos que SQLite revierte TODO.
 */
describe('ConfirmDoseUseCase — atomicidad real contra SQLite (better-sqlite3)', () => {
  it('confirma la toma y decrementa el stock en una única transacción exitosa', async () => {
    const { context, transactionRunner } = await createTestDb();
    await seedTreatment(context, {
      treatment: { id: 't1', stock: { currentQuantity: 10, dailyConsumption: 1, unit: MeasurementUnit.UNIT, criticalThresholdDays: 3 } },
    });

    const doseRepo = new SqliteDoseRepository(context);
    await doseRepo.createSlots([buildDose({ id: 'd1', treatmentId: 't1' })]);

    const treatmentRepo = new SqliteTreatmentRepository(context);
    const stockRepo = new SqliteStockRepository(context);
    const useCase = new ConfirmDoseUseCase(
      doseRepo,
      treatmentRepo,
      stockRepo,
      transactionRunner,
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

  it('ROLLBACK real: si la segunda escritura de la transacción falla, SQLite revierte también la primera', async () => {
    const { context, transactionRunner } = await createTestDb();
    await seedTreatment(context, {
      treatment: { id: 't1', stock: { currentQuantity: 10, dailyConsumption: 1, unit: MeasurementUnit.UNIT, criticalThresholdDays: 3 } },
    });

    const doseRepo = new SqliteDoseRepository(context);
    await doseRepo.createSlots([buildDose({ id: 'd1', treatmentId: 't1' })]);

    const treatmentRepo = new SqliteTreatmentRepository(context);
    const stockRepo = new SqliteStockRepository(context);

    // Monkey-patch: el decrement ejecuta el UPDATE real contra `tx` (queda
    // pendiente de commit) y LUEGO lanza — exactamente el escenario que
    // debe disparar el ROLLBACK de la transacción SQL completa.
    const originalDecrement = stockRepo.decrement.bind(stockRepo);
    stockRepo.decrement = async (treatmentId: string, quantity: number) => {
      const partial = await originalDecrement(treatmentId, quantity);
      if (!partial.ok) return partial;
      throw new Error('fallo simulado tras escribir el UPDATE de stock');
    };

    const useCase = new ConfirmDoseUseCase(
      doseRepo,
      treatmentRepo,
      stockRepo,
      transactionRunner,
      new FakeClock(new Date('2026-08-01T08:05:00.000Z')),
    );

    const result = await useCase.execute({ doseId: 'd1', requestingPatientId: 'patient-1' });
    expect(result.ok).toBe(false);

    // La prueba real: consultamos la DB directamente (fuera de cualquier
    // transacción abierta) y confirmamos que NINGUNO de los dos cambios
    // quedó persistido — el UPDATE de stock que sí llegó a ejecutarse
    // contra `tx` fue revertido por el ROLLBACK.
    const doseRow = await context.getExecutor().queryOne<{ status: string }>(
      `SELECT status FROM doses WHERE id = 'd1'`,
    );
    const stockRow = await context.getExecutor().queryOne<{ stock_current_quantity: number }>(
      `SELECT stock_current_quantity FROM treatments WHERE id = 't1'`,
    );
    expect(doseRow?.status).toBe('PENDING');
    expect(stockRow?.stock_current_quantity).toBe(10);
  });
});
