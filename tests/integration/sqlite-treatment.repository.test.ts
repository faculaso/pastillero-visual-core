import { describe, it, expect } from 'vitest';
import { createTestDb } from './test-db';
import { seedTreatment, seedMedication } from './seed';
import { SqliteTreatmentRepository } from '../../src/infrastructure/persistence/sqlite/repositories/sqlite-treatment.repository';
import { DosageFrequency, MeasurementUnit, TreatmentStatus } from '../../src/domain';
import { buildTreatment } from '../support/fixtures';

describe('SqliteTreatmentRepository (integración)', () => {
  it('roundtrip: create + findById preserva todos los campos, incluidos arrays JSON y fechas', async () => {
    const { context } = await createTestDb();
    const repo = new SqliteTreatmentRepository(context);
    const medication = await seedMedication(context, { id: 'm1' });

    const original = buildTreatment({
      id: 't1',
      medication,
      dosageScheme: {
        frequency: DosageFrequency.SPECIFIC_WEEKDAYS,
        timesOfDay: [{ hour: 8, minute: 30 }, { hour: 20, minute: 0 }],
        dosagePerTake: { amount: 2, unit: MeasurementUnit.MG },
        startDate: new Date('2026-08-01T00:00:00.000Z'),
        endDate: new Date('2026-12-01T00:00:00.000Z'),
        weekdays: [1, 3, 5],
      },
    });

    const createResult = await repo.create(original);
    expect(createResult.ok).toBe(true);

    const found = await repo.findById('t1');
    expect(found.ok).toBe(true);
    if (!found.ok || !found.value) return;

    expect(found.value.dosageScheme.timesOfDay).toEqual(original.dosageScheme.timesOfDay);
    expect(found.value.dosageScheme.weekdays).toEqual([1, 3, 5]);
    expect(found.value.dosageScheme.startDate.toISOString()).toBe(original.dosageScheme.startDate.toISOString());
    expect(found.value.dosageScheme.endDate?.toISOString()).toBe(original.dosageScheme.endDate?.toISOString());
    expect(found.value.medication.name).toBe(original.medication.name);
  });

  it('findById retorna null si no existe', async () => {
    const { context } = await createTestDb();
    const repo = new SqliteTreatmentRepository(context);
    const result = await repo.findById('no-existe');
    expect(result).toEqual({ ok: true, value: null });
  });

  it('update persiste cambios de status y stock', async () => {
    const { context } = await createTestDb();
    const treatment = await seedTreatment(context, { treatment: { id: 't1' } });
    const repo = new SqliteTreatmentRepository(context);

    const updated = { ...treatment, status: TreatmentStatus.PAUSED, stock: { ...treatment.stock, currentQuantity: 5 } };
    const updateResult = await repo.update(updated);
    expect(updateResult.ok).toBe(true);

    const found = await repo.findById('t1');
    if (found.ok && found.value) {
      expect(found.value.status).toBe(TreatmentStatus.PAUSED);
      expect(found.value.stock.currentQuantity).toBe(5);
    }
  });

  it('findActiveByPatient filtra por patientId + status ACTIVE', async () => {
    const { context } = await createTestDb();
    await seedTreatment(context, { medication: { id: 'm1' }, treatment: { id: 't1', patientId: 'p1', status: TreatmentStatus.ACTIVE } });
    await seedTreatment(context, { medication: { id: 'm2' }, treatment: { id: 't2', patientId: 'p1', status: TreatmentStatus.PAUSED } });
    await seedTreatment(context, { medication: { id: 'm3' }, treatment: { id: 't3', patientId: 'p2', status: TreatmentStatus.ACTIVE } });

    const repo = new SqliteTreatmentRepository(context);
    const result = await repo.findActiveByPatient('p1');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.map((t) => t.id)).toEqual(['t1']);
    }
  });

  it('delete elimina el treatment', async () => {
    const { context } = await createTestDb();
    await seedTreatment(context, { treatment: { id: 't1' } });
    const repo = new SqliteTreatmentRepository(context);

    await repo.delete('t1');
    const found = await repo.findById('t1');
    expect(found).toEqual({ ok: true, value: null });
  });
});
