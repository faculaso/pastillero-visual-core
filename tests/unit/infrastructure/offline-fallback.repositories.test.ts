import { describe, it, expect, beforeEach } from 'vitest';
import {
  OfflineFallbackDoseRepository,
  OfflineFallbackTreatmentRepository,
} from '../../../src/infrastructure/persistence/offline/offline-fallback.repositories';
import { Ok, Err, DomainErrors, DoseStatus } from '../../../src/domain';
import type { SnapshotCache } from '../../../src/application';
import { buildDose, buildTreatment } from '../../support/fixtures';

class FakeCache implements SnapshotCache {
  readonly store = new Map<string, string>();

  async read<T>(key: string): Promise<T | null> {
    const raw = this.store.get(key);
    return raw === undefined ? null : (JSON.parse(raw, reviveDates) as T);
  }

  async write<T>(key: string, value: T): Promise<void> {
    this.store.set(key, JSON.stringify(value));
  }
}

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
function reviveDates(_k: string, v: unknown): unknown {
  return typeof v === 'string' && ISO.test(v) ? new Date(v) : v;
}

/**
 * Sin esto, perder la conexión significaba perder el pastillero: sonaba la
 * alarma, el adulto mayor abría la app y no había ni qué pastilla tomar.
 * Los contratos del dominio ya prometían funcionar sin red.
 */
describe('respaldo offline de lecturas', () => {
  const hoy = new Date(2026, 8, 17, 9, 0, 0);
  let cache: FakeCache;

  beforeEach(() => {
    cache = new FakeCache();
  });

  it('cuando el remoto anda, devuelve lo remoto y lo deja guardado', async () => {
    const dose = buildDose({ id: 'd1', treatmentId: 't1', scheduledAt: hoy });
    const remote = { findPendingByPatientAndDate: async () => Ok([dose]) } as never;
    const repo = new OfflineFallbackDoseRepository(remote, cache);

    const result = await repo.findPendingByPatientAndDate('p1', hoy);

    expect(result.ok && result.value).toHaveLength(1);
    expect(cache.store.size).toBe(1);
  });

  it('cuando el remoto falla, sirve lo último que se supo', async () => {
    const dose = buildDose({ id: 'd1', treatmentId: 't1', scheduledAt: hoy });
    let falla = false;
    const remote = {
      findPendingByPatientAndDate: async () =>
        falla ? Err(DomainErrors.repositoryFailure(new Error('sin red'))) : Ok([dose]),
    } as never;
    const repo = new OfflineFallbackDoseRepository(remote, cache);

    await repo.findPendingByPatientAndDate('p1', hoy);
    falla = true;
    const result = await repo.findPendingByPatientAndDate('p1', hoy);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value[0]?.id).toBe('d1');
  });

  it('las fechas vuelven siendo Date, no texto — si no, el dominio rompería en silencio', async () => {
    const dose = buildDose({ id: 'd1', treatmentId: 't1', scheduledAt: hoy, status: DoseStatus.PENDING });
    let falla = false;
    const remote = {
      findPendingByPatientAndDate: async () =>
        falla ? Err(DomainErrors.repositoryFailure(new Error('sin red'))) : Ok([dose]),
    } as never;
    const repo = new OfflineFallbackDoseRepository(remote, cache);

    await repo.findPendingByPatientAndDate('p1', hoy);
    falla = true;
    const result = await repo.findPendingByPatientAndDate('p1', hoy);

    expect(result.ok).toBe(true);
    if (result.ok) {
      const recuperada = result.value[0]!;
      expect(recuperada.scheduledAt).toBeInstanceOf(Date);
      expect(recuperada.scheduledAt.getTime()).toBe(hoy.getTime());
    }
  });

  it('si falla y no hay respaldo, propaga el error real en vez de inventar datos', async () => {
    const remote = {
      findPendingByPatientAndDate: async () => Err(DomainErrors.repositoryFailure(new Error('sin red'))),
    } as never;
    const repo = new OfflineFallbackDoseRepository(remote, cache);

    const result = await repo.findPendingByPatientAndDate('p1', hoy);

    expect(result.ok).toBe(false);
  });

  it('el respaldo es por día: no sirve el de ayer como si fuera el de hoy', async () => {
    const ayer = new Date(2026, 8, 16, 9, 0, 0);
    const doseAyer = buildDose({ id: 'd-ayer', treatmentId: 't1', scheduledAt: ayer });
    let falla = false;
    const remote = {
      findPendingByPatientAndDate: async () =>
        falla ? Err(DomainErrors.repositoryFailure(new Error('sin red'))) : Ok([doseAyer]),
    } as never;
    const repo = new OfflineFallbackDoseRepository(remote, cache);

    await repo.findPendingByPatientAndDate('p1', ayer);
    falla = true;
    const result = await repo.findPendingByPatientAndDate('p1', hoy);

    expect(result.ok).toBe(false);
  });

  it('las ESCRITURAS no se respaldan: si no hay red, fallan de verdad', async () => {
    let llamado = false;
    const remote = {
      createSlots: async () => {
        llamado = true;
        return Err(DomainErrors.repositoryFailure(new Error('sin red')));
      },
    } as never;
    const repo = new OfflineFallbackDoseRepository(remote, cache);

    const result = await repo.createSlots([]);

    expect(llamado).toBe(true);
    expect(result.ok).toBe(false);
    expect(cache.store.size).toBe(0);
  });

  it('los tratamientos activos también sobreviven a la caída', async () => {
    const treatment = buildTreatment({ id: 't1', patientId: 'p1' });
    let falla = false;
    const remote = {
      findActiveByPatient: async () =>
        falla ? Err(DomainErrors.repositoryFailure(new Error('sin red'))) : Ok([treatment]),
    } as never;
    const repo = new OfflineFallbackTreatmentRepository(remote, cache);

    await repo.findActiveByPatient('p1');
    falla = true;
    const result = await repo.findActiveByPatient('p1');

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value[0]?.id).toBe('t1');
  });
});
