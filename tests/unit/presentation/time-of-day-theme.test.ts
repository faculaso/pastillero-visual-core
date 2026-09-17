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

  it('el chip se aleja del color del texto en cada turno, no se le acerca', () => {
    // El bug que esto previene: un blanco translúcido fijo servía para los
    // turnos claros pero de noche dejaba texto blanco sobre lavanda (~1.9:1).
    // De noche el chip tiene que oscurecer; de día, aclarar.
    expect(getTimeOfDayTheme(atHour(21)).chipBackground).toMatch(/^rgba\(0, 0, 0/);
    expect(getTimeOfDayTheme(atHour(8)).chipBackground).toMatch(/^rgba\(255, 255, 255/);
    expect(getTimeOfDayTheme(atHour(14)).chipBackground).toMatch(/^rgba\(255, 255, 255/);
  });

  // El contraste real de cada par (texto/fondo, texto/chip) se verifica
  // calculando el ratio WCAG en `time-of-day-contrast.test.ts`, no fijando
  // hexadecimales acá: así se puede retocar un tono sin romper un test que
  // no mide lo que importa.

  it('cada turno trae un ícono de instrucción asociado', () => {
    expect(getTimeOfDayTheme(atHour(8)).instructionEmoji).toBe('💧');
    expect(getTimeOfDayTheme(atHour(14)).instructionEmoji).toBe('🍽️');
    expect(getTimeOfDayTheme(atHour(21)).instructionEmoji).toBe('🌙');
  });
});
