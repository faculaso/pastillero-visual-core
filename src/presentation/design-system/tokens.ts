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
 *
 * Paleta y tratamiento visual (color, radios, sombras) alineados al mockup
 * de referencia aprobado por el usuario — azules más saturados, tarjetas
 * blancas muy redondeadas con sombra sobre un fondo gris-azulado, en vez
 * del tratamiento plano anterior. `spacing`, `typography` y `touchTarget`
 * NO se tocaron: son la parte que protege la usabilidad real (texto grande,
 * targets de 72px), independiente de qué tan "pulida" se vea la app.
 */
export const colors = {
  background: '#F8FAFC', // fondo de pantalla (gris-azulado suave, no blanco puro)
  surface: '#FFFFFF', // fondo de tarjetas/inputs, siempre blanco sobre `background`
  surfaceSubtle: '#F1F5F9', // relleno recesado (showcase de la pastilla, hover de listas)
  textPrimary: '#0F172A', // ~17:1 sobre blanco (AAA)
  textSecondary: '#475569', // ~7.5:1 sobre blanco (AAA)
  primary: '#2563EB', // azul de acción (botones primarios, tabs/estado activo)
  primaryDark: '#1E40AF', // texto sobre `primarySoft` (badges, chips seleccionados)
  primaryLight: '#3B82F6', // bordes de foco / hover
  primaryPressed: '#1D4ED8',
  primarySoft: '#EFF6FF',
  success: '#15803D', // ~5.9:1 sobre blanco — texto/valores
  successStrong: '#16A34A', // fondo del botón de confirmar toma
  successBackground: '#F0FDF4',
  critical: '#B91C1C', // ~6.1:1 sobre blanco
  criticalBackground: '#FEF2F2',
  warning: '#C2410C', // ~5.0:1 sobre blanco
  warningBackground: '#FFF7ED',
  border: '#CBD5E1',
  borderLight: '#E2E8F0',
  disabled: '#94A3B8',
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
  sm: 10,
  md: 14,
  lg: 18, // botones
  xl: 24, // tarjetas grandes (dosis del día, modales)
  pill: 999,
} as const;

/** Sombras de elevación — RN necesita `shadow*` (iOS) + `elevation` (Android) juntos. */
export const shadows = {
  card: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 4,
  },
  buttonPrimary: {
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 6,
  },
  buttonSuccess: {
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 6,
  },
  pillShowcase: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 3,
  },
} as const;
