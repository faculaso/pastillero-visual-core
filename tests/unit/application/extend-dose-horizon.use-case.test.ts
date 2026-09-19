import { describe, it, expect, beforeEach } from 'vitest';
import { ExtendDoseHorizonUseCase } from '../../../src/application';
import { DoseStatus, DosageFrequency, MeasurementUnit, TreatmentStatus } from '../../../src/domain';
import { InMemoryStore, InMemoryDoseRepository, InMemoryTreatmentRepository } from '../../support/in-memory-repos';
import { FakeClock, FakeIdGenerator, FakeNotificationScheduler } from '../../support/fakes';
import { buildTreatment, buildDose } from '../../support/fixtures';

/**
 * El bug de fondo: `RegisterTreatmentUseCase` materializa 30 días de tomas
 * UNA vez, al dar de alta, y nada las regeneraba. A los 30 días un
 * tratamiento crónico se apagaba solo — dejaba de sonar la alarma y el
 * pastillero quedaba vacío — y lo que hacía el Cuidador era volver a cargar
 * el mismo medicamento, duplicándolo.
 */
describe('ExtendDoseHorizonUseCase', () => {
  const now = new Date(2026, 8, 16, 9, 0, 0);
  let store: InMemoryStore;
  let doseRepo: InMemoryDoseRepository;
  let useCase: ExtendDoseHorizonUseCase;

  function buildCronico(id: string) {
    return buildTreatment({
      id,
      patientId: 'patient-1',
      status: TreatmentStatus.ACTIVE,
      dosageScheme: {
        frequency: DosageFrequency.DAILY,
        timesOfDay: [{ hour: 8, minute: 0 }],
        dosagePerTake: { amount: 1, unit: MeasurementUnit.UNIT },
        startDate: new Date(2026, 0, 1),
      },
    });
  }

  beforeEach(() => {
    store = new InMemoryStore();
    doseRepo = new InMemoryDoseRepository(store);
    useCase = new ExtendDoseHorizonUseCase(
      new InMemoryTreatmentRepository(store),
      doseRepo,
      new FakeNotificationScheduler(),
      new FakeIdGenerator(),
      new FakeClock(now),
    );
  });

  it('a un tratamiento crónico que se quedó sin tomas le vuelve a llenar el horizonte', async () => {
    store.treatments.set('t1', buildCronico('t1'));

    const result = await useCase.execute({ patientId: 'patient-1', horizonDays: 10 });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.createdCount).toBeGreaterThan(9);
    expect(store.doses.size).toBeGreaterThan(9);
  });

  it('es IDEMPOTENTE: correrlo dos veces no duplica ni una toma', async () => {
    store.treatments.set('t1', buildCronico('t1'));

    const primera = await useCase.execute({ patientId: 'patient-1', horizonDays: 10 });
    const totalTrasPrimera = store.doses.size;

    const segunda = await useCase.execute({ patientId: 'patient-1', horizonDays: 10 });

    expect(primera.ok && primera.value.createdCount).toBeGreaterThan(0);
    expect(segunda.ok && segunda.value.createdCount).toBe(0);
    expect(store.doses.size).toBe(totalTrasPrimera);
  });

  it('no recrea una toma que ya fue tomada ni una que se saltó', async () => {
    store.treatments.set('t1', buildCronico('t1'));
    // Mañana a las 8, ya confirmada.
    const yaTomada = new Date(2026, 8, 17, 8, 0, 0);
    store.doses.set('d-tomada', buildDose({ id: 'd-tomada', treatmentId: 't1', scheduledAt: yaTomada, status: DoseStatus.TAKEN }));

    await useCase.execute({ patientId: 'patient-1', horizonDays: 10 });

    const enEseHorario = [...store.doses.values()].filter((d) => d.scheduledAt.getTime() === yaTomada.getTime());
    expect(enEseHorario).toHaveLength(1);
    expect(enEseHorario[0]!.status).toBe(DoseStatus.TAKEN);
  });

  it('un tratamiento con fecha de fin ya pasada no genera nada', async () => {
    store.treatments.set(
      't-terminado',
      buildTreatment({
        id: 't-terminado',
        patientId: 'patient-1',
        dosageScheme: {
          frequency: DosageFrequency.DAILY,
          timesOfDay: [{ hour: 8, minute: 0 }],
          dosagePerTake: { amount: 1, unit: MeasurementUnit.UNIT },
          startDate: new Date(2026, 0, 1),
          endDate: new Date(2026, 0, 10),
        },
      }),
    );

    const result = await useCase.execute({ patientId: 'patient-1', horizonDays: 30 });

    expect(result.ok && result.value.createdCount).toBe(0);
    expect(store.doses.size).toBe(0);
  });

  it('respeta la fecha de fin: no pasa de ahí aunque el horizonte sea más largo', async () => {
    store.treatments.set(
      't-corto',
      buildTreatment({
        id: 't-corto',
        patientId: 'patient-1',
        dosageScheme: {
          frequency: DosageFrequency.DAILY,
          timesOfDay: [{ hour: 8, minute: 0 }],
          dosagePerTake: { amount: 1, unit: MeasurementUnit.UNIT },
          startDate: new Date(2026, 8, 16),
          endDate: new Date(2026, 8, 20), // 5 días contando inclusive
        },
      }),
    );

    const result = await useCase.execute({ patientId: 'patient-1', horizonDays: 30 });

    expect(result.ok && result.value.createdCount).toBe(5);
  });

  it('ignora los tratamientos que no están activos', async () => {
    store.treatments.set('t-baja', {
      ...buildCronico('t-baja'),
      status: TreatmentStatus.CANCELLED,
    });

    const result = await useCase.execute({ patientId: 'patient-1', horizonDays: 10 });

    expect(result.ok && result.value.createdCount).toBe(0);
  });

  it('no toca los tratamientos de otro paciente', async () => {
    store.treatments.set('t-otro', buildTreatment({ ...buildCronico('t-otro'), patientId: 'patient-2' }));

    const result = await useCase.execute({ patientId: 'patient-1', horizonDays: 10 });

    expect(result.ok && result.value.createdCount).toBe(0);
  });

  describe('tomas ya creadas en otro huso horario', () => {
    it('NO duplica la serie cuando los instantes no coinciden pero el día ya está cubierto', async () => {
      // Pasó de verdad, con un tratamiento real: los horarios del esquema
      // son hora de PARED ("05:30"), y se resuelven con el huso del
      // dispositivo. El mismo tratamiento cargado desde un teléfono
      // argentino y abierto después en otro dispositivo en GMT daba
      // instantes distintos para la misma toma. Comparando solo por
      // instante exacto no se reconocía NINGUNA y se generaba la serie
      // entera de nuevo: dos pastillas donde iba una, la adherencia partida
      // al medio, y una alarma a una hora equivocada.
      const treatment = buildCronico('t-huso');
      store.treatments.set(treatment.id, treatment);

      // Las que ya existen: mismo día local, pero corridas 3 horas — que es
      // exactamente lo que produce el desfasaje de huso.
      const DESFASAJE_MS = 3 * 60 * 60 * 1000;
      for (let dia = 0; dia < 31; dia += 1) {
        const scheduledAt = new Date(2026, 8, 16 + dia, 8, 0, 0);
        scheduledAt.setTime(scheduledAt.getTime() + DESFASAJE_MS);
        store.doses.set(`d-${dia}`, buildDose({
          id: `d-${dia}`,
          treatmentId: treatment.id,
          scheduledAt,
          status: DoseStatus.PENDING,
        }));
      }
      const antes = store.doses.size;

      const result = await useCase.execute({ patientId: 'patient-1' });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.createdCount).toBe(0);
      expect(store.doses.size).toBe(antes);
    });

    it('igual completa un día al que de verdad le falta una toma', async () => {
      // El guardia por día no puede volverse una excusa para no crear nada:
      // si el esquema pide dos tomas y ese día hay una sola, falta una.
      const treatment = buildTreatment({
        id: 't-dos-veces',
        patientId: 'patient-1',
        status: TreatmentStatus.ACTIVE,
        dosageScheme: {
          frequency: DosageFrequency.DAILY,
          timesOfDay: [{ hour: 8, minute: 0 }, { hour: 20, minute: 0 }],
          dosagePerTake: { amount: 1, unit: MeasurementUnit.UNIT },
          startDate: new Date(2026, 0, 1),
        },
      });
      store.treatments.set(treatment.id, treatment);

      // Un solo horario cubierto hoy, y corrido de huso para que tampoco
      // coincida por instante.
      const soloUna = new Date(2026, 8, 16, 8, 0, 0);
      soloUna.setTime(soloUna.getTime() + 3 * 60 * 60 * 1000);
      store.doses.set('d-unica', buildDose({
        id: 'd-unica',
        treatmentId: treatment.id,
        scheduledAt: soloUna,
        status: DoseStatus.PENDING,
      }));

      const result = await useCase.execute({ patientId: 'patient-1', horizonDays: 0 });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      // Hoy tiene 1 de 2 previstas: falta exactamente una.
      expect(result.value.createdCount).toBe(1);
    });
  });
});
