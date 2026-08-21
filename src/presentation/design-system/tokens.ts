/**
 * Tokens de diseño accesibles para el perfil de usuario de ACT-01 (adulto
 * mayor). Decisiones que se apartan de defaults móviles "estándar":
 *  - Touch targets mínimos de 72px (vs. 44-48px recomendado para adultos
 *    jóvenes) — compensa menor precisión motora.
 *  - Escala tipográfica de piso más alto (16px como "small", no como base) —
 *    evita depender de que el usuario haya configurado accesibilidad del OS.
 *  - Paleta con contraste AAA (>=7:1) en texto sobre fondo, no solo AA.
 *  - Sin dependencia de color solo: cada estado (pendiente/confirmado/error)
 *    combina color + ícono + texto, para daltonismo y baja visión.
 */
export const colors = {
  background: '#FFFFFF',
  surface: '#F5F7FA',
  textPrimary: '#1A1A1A', // ~15.8:1 sobre #FFFFFF (AAA)
  textSecondary: '#4A4A4A', // ~8.6:1 sobre #FFFFFF (AAA)
  primary: '#0B5FA5', // azul con buen contraste sobre blanco (~6.3:1, AA large text)
  primaryPressed: '#08487D',
  success: '#1B7A3D', // ~5.9:1 sobre blanco
  successBackground: '#E6F4EA',
  critical: '#B3261E', // ~6.4:1 sobre blanco
  criticalBackground: '#FCEAE9',
  warning: '#8A5A00',
  warningBackground: '#FFF4E0',
  border: '#D0D5DD',
  disabled: '#9AA1AC',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const typography = {
  small: 16, // "small" para esta app ya es el body-text estándar de otras apps
  body: 20,
  label: 22,
  title: 28,
  display: 36, // nombre del medicamento, foco visual principal de la pantalla
} as const;

export const touchTarget = {
  minHeight: 72,
  minWidth: 72,
  confirmButtonHeight: 96, // el botón más importante de toda la app (CU-02 paso 4)
} as const;

export const radii = {
  sm: 8,
  md: 16,
  lg: 24,
  pill: 999,
} as const;
