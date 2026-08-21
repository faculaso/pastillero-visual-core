import { describe, it, expect } from 'vitest';
import { createTestDb } from './test-db';
import { seedTreatment } from './seed';
import { SqliteStockRepository } from '../../src/infrastructure/persistence/sqlite/repositories/sqlite-stock.repository';
import { MeasurementUnit, TreatmentStatus } from '../../src/domain';

describe('SqliteStockRepository (integración)', () => {
  it('decrement resta correctamente cuando hay stock suficiente', async () => {
    const { context } = await createTestDb();
    await seedTreatment(context, {
      treatment: { id: 't1', stock: { currentQuantity: 10, dailyConsumption: 1, unit: MeasurementUnit.UNIT, criticalThresholdDays: 3 } },
    });
    const repo = new SqliteStockRepository(context);

    const result = await repo.decrement('t1', 3);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.currentQuantity).toBe(7);
  });

  it('decrement falla con STOCK_INSUFFICIENT y no modifica la fila (UPDATE condicional real en SQL)', async () => {
    const { context } = await createTestDb();
    await seedTreatment(context, {
      treatment: { id: 't1', stock: { currentQuantity: 2, dailyConsumption: 1, unit: MeasurementUnit.UNIT, criticalThresholdDays: 3 } },
    });
    const repo = new SqliteStockRepository(context);

    const result = await repo.decrement('t1', 5);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('STOCK_INSUFFICIENT');

    const afterFailure = await repo.getStock('t1');
    if (afterFailure.ok) expect(afterFailure.value.currentQuantity).toBe(2); // sin cambios
  });

  it('decrement sobre treatment inexistente falla con TREATMENT_NOT_FOUND', async () => {
    const { context } = await createTestDb();
    const repo = new SqliteStockRepository(context);
    const result = await repo.decrement('no-existe', 1);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('TREATMENT_NOT_FOUND');
  });

  it('updateStock reemplaza la cantidad (recarga tras compra)', async () => {
    const { context } = await createTestDb();
    await seedTreatment(context, {
      treatment: { id: 't1', stock: { currentQuantity: 1, dailyConsumption: 1, unit: MeasurementUnit.UNIT, criticalThresholdDays: 3 } },
    });
    const repo = new SqliteStockRepository(context);

    const result = await repo.updateStock('t1', 30);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.currentQuantity).toBe(30);
  });

  it('findCriticalStockTreatments retorna solo tratamientos ACTIVE con días restantes <= umbral', async () => {
    const { context } = await createTestDb();
    await seedTreatment(context, {
      medication: { id: 'm1' },
      treatment: {
        id: 't1',
        caregiverId: 'c1',
        status: TreatmentStatus.ACTIVE,
        stock: { currentQuantity: 2, dailyConsumption: 1, unit: MeasurementUnit.UNIT, criticalThresholdDays: 3 }, // CRITICAL
      },
    });
    await seedTreatment(context, {
      medication: { id: 'm2' },
      treatment: {
        id: 't2',
        caregiverId: 'c1',
        status: TreatmentStatus.ACTIVE,
        stock: { currentQuantity: 30, dailyConsumption: 1, unit: MeasurementUnit.UNIT, criticalThresholdDays: 3 }, // NORMAL
      },
    });
    await seedTreatment(context, {
      medication: { id: 'm3' },
      treatment: {
        id: 't3',
        caregiverId: 'c1',
        status: TreatmentStatus.PAUSED, // no ACTIVE, se excluye aunque el stock sea crítico
        stock: { currentQuantity: 1, dailyConsumption: 1, unit: MeasurementUnit.UNIT, criticalThresholdDays: 3 },
      },
    });

    const repo = new SqliteStockRepository(context);
    const result = await repo.findCriticalStockTreatments('c1');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.map((t) => t.id)).toEqual(['t1']);
  });
});
