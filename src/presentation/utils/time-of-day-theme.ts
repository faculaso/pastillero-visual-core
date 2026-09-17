export type TimeOfDayPeriod = 'morning' | 'afternoon' | 'night';

export interface TimeOfDayTheme {
  readonly period: TimeOfDayPeriod;
  readonly label: string;
  readonly emoji: string;
  readonly background: string;
  /** Texto principal DIRECTAMENTE sobre `background`. */
  readonly accentText: string;
  /**
   * Texto secundario directamente sobre `background` (hints, dots inactivos).
   * Existe porque `colors.textSecondary` está calculado contra superficies
   * CLARAS: sobre el fondo índigo de la noche da ~1.4:1, ilegible. Nada que
   * se dibuje sobre `background` puede usar tokens de la paleta base.
   */
  readonly mutedText: string;
  /**
   * Fondo del chip de turno. La regla es que se ALEJE de `accentText`, no que
   * se le acerque: en los turnos claros aclara (blanco translúcido sobre
   * celeste/ámbar), de noche oscurece. Un blanco translúcido fijo servía para
   * mañana/tarde pero de noche dejaba texto blanco sobre lavanda (~1.9:1).
   */
  readonly chipBackground: string;
  readonly chipBorder: string;
  /**
   * Ranura hundida sobre `background` (el track de la barra de progreso).
   * Misma regla que `chipBackground` invertida: tiene que leerse como un
   * hueco, así que oscurece en los turnos claros y aclara en el oscuro.
   */
  readonly recessedSurface: string;
  /** Ícono ilustrado del contexto de toma asociado a este turno — ver docblock de `getTimeOfDayTheme`. */
  readonly instructionEmoji: string;
  readonly instructionLabel: string;
}

const MORNING: TimeOfDayTheme = {
  period: 'morning',
  label: 'Mañana',
  emoji: '🌅',
  background: '#E3F2FD', // azul cielo suave
  accentText: '#084A7F', // 8.0:1 sobre background (AAA)
  mutedText: '#334155', // 11:1 sobre background
  chipBackground: 'rgba(255, 255, 255, 0.75)',
  chipBorder: 'rgba(8, 74, 127, 0.25)',
  recessedSurface: 'rgba(15, 23, 42, 0.14)',
  instructionEmoji: '💧',
  instructionLabel: 'Tomar con agua',
};

const AFTERNOON: TimeOfDayTheme = {
  period: 'afternoon',
  label: 'Tarde',
  emoji: '☀️',
  background: '#FFF3E0', // ámbar / dorado cálido
  accentText: '#7C3806', // 7.9:1 sobre background (AAA)
  mutedText: '#7C2D12', // 8.5:1 sobre background
  chipBackground: 'rgba(255, 255, 255, 0.75)',
  chipBorder: 'rgba(124, 56, 6, 0.25)',
  recessedSurface: 'rgba(120, 53, 15, 0.16)',
  instructionEmoji: '🍽️',
  instructionLabel: 'Tomar después de comer',
};

const NIGHT: TimeOfDayTheme = {
  period: 'night',
  label: 'Noche',
  emoji: '🌙',
  background: '#1A237E', // azul marino / índigo relajado
  accentText: '#FFFFFF', // tipografía clara sobre fondo oscuro, pedido explícito
  mutedText: 'rgba(255, 255, 255, 0.78)', // ~9:1 sobre background
  // Oscurece en vez de aclarar: es el único turno con fondo oscuro, así que
  // aclarar el chip lo acercaría al blanco del texto en vez de alejarlo.
  chipBackground: 'rgba(0, 0, 0, 0.3)',
  chipBorder: 'rgba(255, 255, 255, 0.35)',
  recessedSurface: 'rgba(255, 255, 255, 0.22)',
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
