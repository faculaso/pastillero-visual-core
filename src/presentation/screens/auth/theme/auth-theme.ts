/**
 * Paleta y timings SOLO para el flujo de autenticación/vinculación —
 * deliberadamente distinta del azul "de acción" global (`colors.primary`,
 * design-system/tokens.ts) para leer como una superficie de marca propia
 * (login/pairing), no como una pantalla más de la app clínica. El texto
 * sigue usando `colors.textPrimary`/`textSecondary`/`critical` de los
 * tokens globales: el contraste AAA es una decisión de producto, no de
 * esta pantalla en particular.
 */
import { colors } from '../../../design-system/tokens';

export const authPalette = {
  // Plano y del color de las superficies: el neumorfismo apoya la tarjeta
  // sobre su MISMO color, asi que un degradado celeste debajo la delata.
  gradientTop: colors.background,
  gradientBottom: colors.background,
  clinicalBlue: '#0284C7',
  clinicalBlueLight: '#0EA5E9',
  // Los glows y el borde de tarjeta quedan neutralizados, no borrados:
  // siguen referenciados desde varios componentes y volverlos
  // transparentes evita tocar JSX en cinco archivos por una decoracion.
  glow: 'transparent',
  glowSoft: 'transparent',
  cardBorder: 'transparent',
  inputIdleBorder: '#E2E8F0',
  inputFilledBorder: '#CBD5E1',
} as const;
