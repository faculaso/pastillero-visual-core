import { describe, it, expect } from 'vitest';
import { buildTreatmentDates, formatStartDayLabel, formatTreatmentPeriod } from '../../../src/presentation/utils/treatment-dates';
import { calculateScheduledDoseTimes } from '../../../src/domain';
import { DosageFrequency, MeasurementUnit } from '../../../src/domain';

// Miércoles 2026-09-16, 10:30 de la mañana.
const AHORA = new Date(2026, 8, 16, 10, 30, 0);

describe('buildTreatmentDates', () => {
  it('sin duración es crónico: no hay fecha de fin', () => {
    const { startDate, endDate } = buildTreatmentDates(AHORA, 0, null);
    expect(endDate).toBeUndefined();
    expect(startDate.getDate()).toBe(16);
  });

  it('arranca al comienzo del día, no a la hora en que se cargó', () => {
    const { startDate } = buildTreatmentDates(AHORA, 0, null);
    expect(startDate.getHours()).toBe(0);
    expect(startDate.getMinutes()).toBe(0);
  });

  it('el desplazamiento corre el inicio a otro día de la semana', () => {
    expect(buildTreatmentDates(AHORA, 1, null).startDate.getDate()).toBe(17);
    expect(buildTreatmentDates(AHORA, 4, null).startDate.getDate()).toBe(20);
  });

  it('la duración es INCLUSIVA: 7 días desde el 16 termina el 22, no el 23', () => {
    const { endDate } = buildTreatmentDates(AHORA, 0, 7);
    expect(endDate?.getDate()).toBe(22);
  });

  it('cruza el fin de mes sin romperse', () => {
    const finDeMes = new Date(2026, 8, 28, 9, 0, 0); // 28 de septiembre
    const { endDate } = buildTreatmentDates(finDeMes, 0, 7);
    expect(endDate?.getMonth()).toBe(9); // octubre
    expect(endDate?.getDate()).toBe(4);
  });
});

describe('las fechas cortan de verdad la generación de dosis', () => {
  /**
   * La razón de ser de todo esto: sin `endDate`, un tratamiento de 7 días
   * generaba igual las dosis de los 30 días del horizonte. Esas 23 tomas
   * fantasma sonaban la alarma y contaban como incumplidas en la adherencia.
   */
  it('un tratamiento de 7 días genera 7 tomas, no las 30 del horizonte', () => {
    const { startDate, endDate } = buildTreatmentDates(AHORA, 0, 7);
    const horizonte = new Date(AHORA);
    horizonte.setDate(horizonte.getDate() + 30);

    const tomas = calculateScheduledDoseTimes(
      {
        frequency: DosageFrequency.DAILY,
        timesOfDay: [{ hour: 8, minute: 0 }],
        dosagePerTake: { amount: 1, unit: MeasurementUnit.UNIT },
        startDate,
        endDate,
      },
      AHORA,
      horizonte,
    );

    expect(tomas).toHaveLength(7);
  });

  it('sin fecha de fin sigue llenando todo el horizonte (tratamiento crónico)', () => {
    const { startDate, endDate } = buildTreatmentDates(AHORA, 0, null);
    const horizonte = new Date(AHORA);
    horizonte.setDate(horizonte.getDate() + 30);

    const tomas = calculateScheduledDoseTimes(
      {
        frequency: DosageFrequency.DAILY,
        timesOfDay: [{ hour: 8, minute: 0 }],
        dosagePerTake: { amount: 1, unit: MeasurementUnit.UNIT },
        startDate,
        endDate,
      },
      AHORA,
      horizonte,
    );

    expect(tomas.length).toBeGreaterThan(29);
  });
});

describe('formatStartDayLabel', () => {
  it('nombra los dos primeros días en vez de mostrar una fecha', () => {
    expect(formatStartDayLabel(AHORA, 0)).toBe('Hoy');
    expect(formatStartDayLabel(AHORA, 1)).toBe('Mañana');
  });

  it('del tercero en adelante muestra día de la semana y número', () => {
    // 2026-09-18 es viernes.
    expect(formatStartDayLabel(AHORA, 2)).toBe('Vie 18');
  });
});

describe('formatTreatmentPeriod', () => {
  it('lo crónico se dice, no se deja en blanco', () => {
    expect(formatTreatmentPeriod(AHORA, 0, null)).toBe('Desde hoy, sin fecha de fin.');
  });

  it('calcula el final por vos: 7 días desde el viernes terminan el jueves siguiente', () => {
    // AHORA es miércoles 16; offset 2 cae viernes 18.
    expect(formatTreatmentPeriod(AHORA, 2, 7)).toBe('Desde viernes 18 de septiembre hasta el jueves 24 de septiembre.');
  });

  it('empezando hoy dice "hoy", no la fecha', () => {
    expect(formatTreatmentPeriod(AHORA, 0, 14)).toBe('Desde hoy hasta el martes 29 de septiembre.');
  });
});
