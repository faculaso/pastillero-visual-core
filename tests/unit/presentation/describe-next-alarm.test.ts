import { describe, it, expect } from 'vitest';
import { describeNextAlarm } from '../../../src/presentation/utils/describe-next-alarm';

describe('describeNextAlarm', () => {
  it('dice "hoy" cuando cae el mismo día', () => {
    const ahora = new Date(2026, 8, 26, 9, 0);
    expect(describeNextAlarm(new Date(2026, 8, 26, 20, 30), ahora)).toBe('hoy a las 20:30');
  });

  it('dice "mañana" aunque falten pocas horas — a las 23:00, dentro de dos horas ya es otro día', () => {
    // El caso que rompió un test escrito con "ahora + 2 horas": comparar
    // horas de diferencia en vez de días de calendario da "hoy" pasada la
    // medianoche, que es justo lo que nadie espera leer.
    const ahora = new Date(2026, 8, 26, 23, 0);
    expect(describeNextAlarm(new Date(2026, 8, 27, 1, 0), ahora)).toBe('mañana a las 01:00');
  });

  it('para más adelante da la fecha, sin año: el horizonte es de un mes', () => {
    const ahora = new Date(2026, 8, 26, 9, 0);
    expect(describeNextAlarm(new Date(2026, 9, 3, 8, 0), ahora)).toBe('3 de octubre a las 08:00');
  });

  it('usa 24 horas: el mediodía y la medianoche no pueden confundirse', () => {
    const ahora = new Date(2026, 8, 26, 1, 0);
    expect(describeNextAlarm(new Date(2026, 8, 26, 0, 30), ahora)).toBe('hoy a las 00:30');
    expect(describeNextAlarm(new Date(2026, 8, 26, 12, 0), ahora)).toBe('hoy a las 12:00');
  });
});
