export type TimeOfDayPeriod = 'morning' | 'afternoon' | 'night';

export interface TimeOfDayTheme {
  readonly period: TimeOfDayPeriod;
  readonly label: string;
  readonly emoji: string;
  readonly background: string;
  readonly accentText: string;
  /** Ícono ilustrado del contexto de toma asociado a este turno — ver docblock de `getTimeOfDayTheme`. */
  readonly instructionEmoji: string;
  readonly instructionLabel: string;
}

const MORNING: TimeOfDayTheme = {
  period: 'morning',
  label: 'Mañana',
  emoji: '🌅',
  background: '#E3F2FD', // azul cielo suave
  accentText: '#0B5FA5',
  instructionEmoji: '💧',
  instructionLabel: 'Tomar con agua',
};

const AFTERNOON: TimeOfDayTheme = {
  period: 'afternoon',
  label: 'Tarde',
  emoji: '☀️',
  background: '#FFF3E0', // ámbar / dorado cálido
  accentText: '#B45309',
  instructionEmoji: '🍽️',
  instructionLabel: 'Tomar después de comer',
};

const NIGHT: TimeOfDayTheme = {
  period: 'night',
  label: 'Noche',
  emoji: '🌙',
  background: '#1A237E', // azul marino / índigo relajado
  accentText: '#FFFFFF', // tipografía clara sobre fondo oscuro, pedido explícito
  instructionEmoji: '🌙',
  instructionLabel: 'Tomar antes de dormir',
};

/**
 * Deriva el "turno" del horario programado de la toma — no de un campo de
 * instrucción explícito, porque `DosageScheme` no lo tiene (agregarlo es la
 * extensión natural si el negocio necesita instrucciones libres tipo "con
 * el estómago vacío"). Mañana 5-12hs, Tarde 12-19hs, Noche 19-5hs — cortes
 * simples, no astronómicos, para que el turno sea predecible para el
 * Cuidador que configura el horario.
 */
export function getTimeOfDayTheme(date: Date): TimeOfDayTheme {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return MORNING;
  if (hour >= 12 && hour < 19) return AFTERNOON;
  return NIGHT;
}
