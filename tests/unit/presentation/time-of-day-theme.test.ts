import { describe, it, expect } from 'vitest';
import { getTimeOfDayTheme } from '../../../src/presentation/utils/time-of-day-theme';

function atHour(hour: number): Date {
  const d = new Date('2026-08-01T00:00:00.000');
  d.setHours(hour, 0, 0, 0);
  return d;
}

describe('getTimeOfDayTheme', () => {
  it.each([5, 8, 11])('hora %i -> mañana', (hour) => {
    expect(getTimeOfDayTheme(atHour(hour)).period).toBe('morning');
  });

  it.each([12, 15, 18])('hora %i -> tarde', (hour) => {
    expect(getTimeOfDayTheme(atHour(hour)).period).toBe('afternoon');
  });

  it.each([19, 22, 0, 4])('hora %i -> noche', (hour) => {
    expect(getTimeOfDayTheme(atHour(hour)).period).toBe('night');
  });

  it('la noche usa texto claro sobre fondo oscuro', () => {
    const theme = getTimeOfDayTheme(atHour(21));
    expect(theme.accentText).toBe('#FFFFFF');
  });

  it('cada turno trae un ícono de instrucción asociado', () => {
    expect(getTimeOfDayTheme(atHour(8)).instructionEmoji).toBe('💧');
    expect(getTimeOfDayTheme(atHour(14)).instructionEmoji).toBe('🍽️');
    expect(getTimeOfDayTheme(atHour(21)).instructionEmoji).toBe('🌙');
  });
});
