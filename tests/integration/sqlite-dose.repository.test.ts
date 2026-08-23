import { describe, it, expect } from 'vitest';
import { createTestDb } from './test-db';
import { seedTreatment } from './seed';
import { SqliteDoseRepository } from '../../src/infrastructure/persistence/sqlite/repositories/sqlite-dose.repository';
import { DoseStatus, MeasurementUnit } from '../../src/domain';
import { buildDose } from '../support/fixtures';

describe('SqliteDoseRepository (integración)', () => {
  it('createSlots + findById roundtrip', async () => {
    const { context } = await createTestDb();
    await seedTreatment(context, { treatment: { id: 't1' } });
    const repo = new SqliteDoseRepository(context);

    const dose = buildDose({ id: 'd1', treatmentId: 't1' });
    await repo.createSlots([dose]);

    const found = await repo.findById('d1');
    expect(found.ok).toBe(true);
    if (found.ok) expect(found.value?.status).toBe(DoseStatus.PENDING);
  });

  it('confirmDose transiciona PENDING -> TAKEN y persiste quantityTaken', async () => {
    const { context } = await createTestDb();
    await seedTreatment(context, { treatment: { id: 't1' } });
    const repo = new SqliteDoseRepository(context);
    await repo.createSlots([buildDose({ id: 'd1', treatmentId: 't1' })]);

    const confirmedAt = new Date('2026-08-01T08:05:00.000Z');
    const result = await repo.confirmDose('d1', confirmedAt, { amount: 1, unit: MeasurementUnit.UNIT });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe(DoseStatus.TAKEN);
      expect(result.value.confirmedAt?.toISOString()).toBe(confirmedAt.toISOString());
      expect(result.value.quantityTaken).toEqual({ amount: 1, unit: MeasurementUnit.UNIT });
    }
  });

  it('confirmDose sobre una toma ya TAKEN falla con DOSE_ALREADY_CONFIRMED (UPDATE condicional en SQL)', async () => {
    const { context } = await createTestDb();
    await seedTreatment(context, { treatment: { id: 't1' } });
    const repo = new SqliteDoseRepository(context);
    await repo.createSlots([buildDose({ id: 'd1', treatmentId: 't1' })]);

    await repo.confirmDose('d1', new Date());
    const second = await repo.confirmDose('d1', new Date());

    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error.code).toBe('DOSE_ALREADY_CONFIRMED');
  });

  it('confirmDose sobre id inexistente falla con DOSE_NOT_FOUND', async () => {
    const { context } = await createTestDb();
    const repo = new SqliteDoseRepository(context);
    const result = await repo.confirmDose('no-existe', new Date());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('DOSE_NOT_FOUND');
  });

  it('findByTreatmentInRange filtra correctamente por fecha', async () => {
    const { context } = await createTestDb();
    await seedTreatment(context, { treatment: { id: 't1' } });
    const repo = new SqliteDoseRepository(context);
    await repo.createSlots([
      buildDose({ id: 'd1', treatmentId: 't1', scheduledAt: new Date('2026-08-01T08:00:00.000Z') }),
      buildDose({ id: 'd2', treatmentId: 't1', scheduledAt: new Date('2026-08-15T08:00:00.000Z') }),
      buildDose({ id: 'd3', treatmentId: 't1', scheduledAt: new Date('2026-09-01T08:00:00.000Z') }),
    ]);

    const result = await repo.findByTreatmentInRange(
      't1',
      new Date('2026-08-01T00:00:00.000Z'),
      new Date('2026-08-31T23:59:59.999Z'),
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.map((d) => d.id).sort()).toEqual(['d1', 'd2']);
  });

  it('findPendingByPatientAndDate hace JOIN con treatments por patient_id', async () => {
    const { context } = await createTestDb();
    await seedTreatment(context, { medication: { id: 'm1' }, treatment: { id: 't1', patientId: 'p1' } });
    await seedTreatment(context, { medication: { id: 'm2' }, treatment: { id: 't2', patientId: 'p2' } });
    const repo = new SqliteDoseRepository(context);

    const targetDate = new Date('2026-08-05T00:00:00.000Z');
    await repo.createSlots([
      buildDose({ id: 'd1', treatmentId: 't1', scheduledAt: new Date('2026-08-05T08:00:00.000Z') }),
      buildDose({ id: 'd2', treatmentId: 't2', scheduledAt: new Date('2026-08-05T08:00:00.000Z') }),
    ]);

    const result = await repo.findPendingByPatientAndDate('p1', targetDate);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.map((d) => d.id)).toEqual(['d1']);
  });

  it('findAllByPatientAndDate trae tomas de CUALQUIER status del día (no solo PENDING)', async () => {
    const { context } = await createTestDb();
    await seedTreatment(context, { medication: { id: 'm1' }, treatment: { id: 't1', patientId: 'p1' } });
    const repo = new SqliteDoseRepository(context);

    const targetDate = new Date('2026-08-05T00:00:00.000Z');
    await repo.createSlots([
      buildDose({ id: 'd1', treatmentId: 't1', scheduledAt: new Date('2026-08-05T08:00:00.000Z') }),
      buildDose({ id: 'd2', treatmentId: 't1', scheduledAt: new Date('2026-08-05T14:00:00.000Z') }),
    ]);
    await repo.confirmDose('d1', new Date('2026-08-05T08:05:00.000Z'));

    const result = await repo.findAllByPatientAndDate('p1', targetDate);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.map((d) => d.id)).toEqual(['d1', 'd2']);
      expect(result.value.find((d) => d.id === 'd1')?.status).toBe('TAKEN');
      expect(result.value.find((d) => d.id === 'd2')?.status).toBe('PENDING');
    }
  });
});
