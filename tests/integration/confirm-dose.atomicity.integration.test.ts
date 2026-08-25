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
 * aplicación — y que un guard que falla (stock insuficiente) hace ROLLBACK
 * de TODO, incluida la actualización de `doses` que ya se había escrito
 * contra `tx` antes de llegar a ese guard.
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

  it('ROLLBACK real: si el guard de stock insuficiente falla, SQLite revierte también la confirmación de la toma ya escrita', async () => {
    const { context } = await createTestDb();
    await seedTreatment(context, {
      // Stock ya insuficiente para la cantidad que se va a intentar tomar —
      // llamamos al REPOSITORIO directamente (no al use case) para aislar el
      // guard SQL de la validación de dominio que correría antes en
      // `ConfirmDoseUseCase` (esa validación de dominio ya se prueba en
      // `tests/unit/application/confirm-dose.use-case.test.ts`; acá lo que
      // importa es que el UPDATE de `doses`, que SÍ llega a ejecutarse
      // contra `tx` antes de que el guard de stock falle, quede revertido).
      treatment: { id: 't1', stock: { currentQuantity: 0, dailyConsumption: 1, unit: MeasurementUnit.UNIT, criticalThresholdDays: 3 } },
    });

    const doseRepo = new SqliteDoseRepository(context);
    await doseRepo.createSlots([buildDose({ id: 'd1', treatmentId: 't1' })]);

    const result = await doseRepo.confirmDoseWithStockDecrement(
      'd1',
      new Date('2026-08-01T08:05:00.000Z'),
      { amount: 1, unit: MeasurementUnit.UNIT },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('STOCK_INSUFFICIENT');

    // La prueba real: consultamos la DB directamente y confirmamos que el
    // UPDATE de `doses` (que sí se ejecutó contra `tx` antes del guard de
    // stock) fue revertido por el ROLLBACK — la toma sigue PENDING.
    const doseRow = await context.getExecutor().queryOne<{ status: string }>(
      `SELECT status FROM doses WHERE id = 'd1'`,
    );
    const stockRow = await context.getExecutor().queryOne<{ stock_current_quantity: number }>(
      `SELECT stock_current_quantity FROM treatments WHERE id = 't1'`,
    );
    expect(doseRow?.status).toBe('PENDING');
    expect(stockRow?.stock_current_quantity).toBe(0);
  });
});
