/**
 * Paleta y timings SOLO para el flujo de autenticación/vinculación —
 * deliberadamente distinta del azul "de acción" global (`colors.primary`,
 * design-system/tokens.ts) para leer como una superficie de marca propia
 * (login/pairing), no como una pantalla más de la app clínica. El texto
 * sigue usando `colors.textPrimary`/`textSecondary`/`critical` de los
 * tokens globales: el contraste AAA es una decisión de producto, no de
 * esta pantalla en particular.
 */
export const authPalette = {
  gradientTop: '#F0F9FF',
  gradientBottom: '#FFFFFF',
  clinicalBlue: '#0284C7',
  clinicalBlueLight: '#0EA5E9',
  glow: 'rgba(14, 165, 233, 0.16)',
  glowSoft: 'rgba(2, 132, 199, 0.08)',
  cardBorder: 'rgba(2, 132, 199, 0.12)',
  inputIdleBorder: '#E2E8F0',
  inputFilledBorder: '#CBD5E1',
} as const;
