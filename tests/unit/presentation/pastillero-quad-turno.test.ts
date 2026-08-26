import { describe, it, expect } from 'vitest';
import { buildQuadBuckets, classifyQuadTurno } from '../../../src/presentation/utils/pastillero-quad-turno';
import { groupDosesByWeek } from '../../../src/presentation/utils/group-doses-by-week';
import { DoseStatus, PillShape } from '../../../src/domain';
import type { WeekDoseView } from '../../../src/application';

const WEEK_START = new Date(2026, 7, 2, 0, 0, 0, 0);

function buildDoseView(overrides: Partial<WeekDoseView> & { readonly scheduledAt: Date }): WeekDoseView {
  return {
    doseId: 'dose-1',
    treatmentId: 'treatment-1',
    medicationName: 'Paracetamol',
    visualProfile: { shape: PillShape.ROUND, color: '#FFFFFF' },
    status: DoseStatus.PENDING,
    ...overrides,
  };
}

function dayAt(offsetDays: number, hour: number): Date {
  const d = new Date(WEEK_START);
  d.setDate(d.getDate() + offsetDays);
  d.setHours(hour, 0, 0, 0);
  return d;
}

describe('classifyQuadTurno', () => {
  it('clasifica los 4 turnos por hora: mañana 5-10, mediodía 11-14, tarde 15-18, noche 19-4', () => {
    expect(classifyQuadTurno(dayAt(0, 5))).toBe('morning');
    expect(classifyQuadTurno(dayAt(0, 10))).toBe('morning');
    expect(classifyQuadTurno(dayAt(0, 11))).toBe('midday');
    expect(classifyQuadTurno(dayAt(0, 14))).toBe('midday');
    expect(classifyQuadTurno(dayAt(0, 15))).toBe('afternoon');
    expect(classifyQuadTurno(dayAt(0, 18))).toBe('afternoon');
    expect(classifyQuadTurno(dayAt(0, 19))).toBe('night');
    expect(classifyQuadTurno(dayAt(0, 4))).toBe('night');
  });
});

describe('buildQuadBuckets', () => {
  it('devuelve 7 días con las 4 franjas, y una dosis de mediodía (12hs) no aparece ni en mañana ni en tarde', () => {
    const middayDose = buildDoseView({ doseId: 'd-midday', scheduledAt: dayAt(1, 12) });
    const quad = buildQuadBuckets(groupDosesByWeek([middayDose], WEEK_START));

    expect(quad).toHaveLength(7);
    expect(quad[1]?.midday.map((d) => d.doseId)).toEqual(['d-midday']);
    expect(quad[1]?.morning).toEqual([]);
    expect(quad[1]?.afternoon).toEqual([]);
  });

  it('preserva mañana y noche tal cual, y parte la "tarde" original (12-19hs) en mediodía + tarde', () => {
    const morningDose = buildDoseView({ doseId: 'd-morning', scheduledAt: dayAt(0, 8) });
    const middayDose = buildDoseView({ doseId: 'd-midday', scheduledAt: dayAt(0, 13) });
    const afternoonDose = buildDoseView({ doseId: 'd-afternoon', scheduledAt: dayAt(0, 17) });
    const nightDose = buildDoseView({ doseId: 'd-night', scheduledAt: dayAt(0, 21) });

    const quad = buildQuadBuckets(groupDosesByWeek([morningDose, middayDose, afternoonDose, nightDose], WEEK_START));

    expect(quad[0]?.morning.map((d) => d.doseId)).toEqual(['d-morning']);
    expect(quad[0]?.midday.map((d) => d.doseId)).toEqual(['d-midday']);
    expect(quad[0]?.afternoon.map((d) => d.doseId)).toEqual(['d-afternoon']);
    expect(quad[0]?.night.map((d) => d.doseId)).toEqual(['d-night']);
  });
});
