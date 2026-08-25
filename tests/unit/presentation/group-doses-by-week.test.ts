import { describe, it, expect } from 'vitest';
import { groupDosesByWeek } from '../../../src/presentation/utils/group-doses-by-week';
import { DoseStatus, PillShape } from '../../../src/domain';
import type { WeekDoseView } from '../../../src/application';

// Domingo 2026-08-02T00:00:00 (local) — mismo día de la semana que usa `resolveWeekBounds`.
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

describe('groupDosesByWeek', () => {
  it('siempre devuelve 7 buckets, domingo (0) a sábado (6), con la fecha correcta', () => {
    const buckets = groupDosesByWeek([], WEEK_START);
    expect(buckets).toHaveLength(7);
    buckets.forEach((bucket, i) => {
      expect(bucket.dayIndex).toBe(i);
      expect(bucket.date.getDate()).toBe(WEEK_START.getDate() + i);
    });
  });

  it('clasifica cada dosis en el día y turno correctos (mañana/tarde/noche)', () => {
    const morningDose = buildDoseView({ doseId: 'd-morning', scheduledAt: dayAt(0, 8) });
    const afternoonDose = buildDoseView({ doseId: 'd-afternoon', scheduledAt: dayAt(3, 15) });
    const nightDose = buildDoseView({ doseId: 'd-night', scheduledAt: dayAt(6, 21) });

    const buckets = groupDosesByWeek([morningDose, afternoonDose, nightDose], WEEK_START);

    expect(buckets[0]?.morning.map((d) => d.doseId)).toEqual(['d-morning']);
    expect(buckets[3]?.afternoon.map((d) => d.doseId)).toEqual(['d-afternoon']);
    expect(buckets[6]?.night.map((d) => d.doseId)).toEqual(['d-night']);
  });

  it('agrupa varias dosis del mismo día y turno en el mismo bucket', () => {
    const first = buildDoseView({ doseId: 'd1', scheduledAt: dayAt(2, 8) });
    const second = buildDoseView({ doseId: 'd2', scheduledAt: dayAt(2, 9) });

    const buckets = groupDosesByWeek([first, second], WEEK_START);

    expect(buckets[2]?.morning.map((d) => d.doseId)).toEqual(['d1', 'd2']);
  });

  it('descarta dosis fuera del rango de la semana pedida', () => {
    const before = buildDoseView({ doseId: 'before', scheduledAt: dayAt(-1, 8) });
    const after = buildDoseView({ doseId: 'after', scheduledAt: dayAt(7, 8) });

    const buckets = groupDosesByWeek([before, after], WEEK_START);

    const allDoseIds = buckets.flatMap((b) => [...b.morning, ...b.afternoon, ...b.night]).map((d) => d.doseId);
    expect(allDoseIds).toEqual([]);
  });
});
