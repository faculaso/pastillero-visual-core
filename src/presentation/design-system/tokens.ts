import { shadeColor } from '../utils/shade-color';
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
  // Neumorfismo: la superficie es del MISMO color que el fondo, y lo que
  // separa una tarjeta del resto no es un relleno distinto sino la sombra —
  // clara arriba a la izquierda, oscura abajo a la derecha, como si el
  // material estuviera extruido desde atrás. Por eso `surface` y
  // `surfaceSubtle` dejaron de ser blancos: si lo fueran, el efecto no
  // existiría. El color se eligió a medio camino entre blanco y el gris de
  // las sombras, porque necesita lugar para iluminarse Y oscurecerse.
  // Valores exactos del generador con el que se eligió el estilo:
  // design.dev/tools/neumorphism — raised, light, dist 12, blur 36,
  // radius 24, intensity 7.
  background: '#DDE3EC',
  surface: '#DDE3EC',
  surfaceSubtle: '#DDE3EC', // recesado: mismas sombras pero hacia adentro (`inset`)
  textPrimary: '#3C4858', // 7.2:1 sobre `background` — sigue siendo AAA (el umbral es 7:1)
  textSecondary: '#475569', // ~5.9:1 sobre `background` (AA)
  primary: '#2563EB', // azul de acción (botones primarios, tabs/estado activo)
  primaryDark: '#1E40AF', // texto sobre `primarySoft` (badges, chips seleccionados)
  primaryLight: '#3B82F6', // bordes de foco / hover
  primaryPressed: '#1D4ED8',
  primarySoft: '#EFF6FF',
  success: '#15803D', // ~5.9:1 sobre blanco — texto/valores
  successStrong: '#16A34A', // fondo del botón de confirmar toma
  successBackground: '#F0FDF4',
  critical: '#B91C1C', // ~6.1:1 sobre blanco
  criticalPressed: '#991B1B', // fondo presionado del botón destructivo
  criticalBackground: '#FEF2F2',
  warning: '#C2410C', // ~5.0:1 sobre blanco
  warningBackground: '#FFF7ED',
  border: '#CBD5E1',
  // Casi invisible a propósito: con superficies extruidas, una línea marcada
  // corta el efecto. `border` (más oscuro) NO se tocó — lo usa el contorno de
  // los botones secundarios, que es lo que los hace legibles como botones.
  borderLight: '#DDE3EC',
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
  sm: 12,
  md: 18,
  lg: 22, // botones
  xl: 24, // tarjetas grandes — el radius del generador
  pill: 999,
} as const;

/**
 * Sombras de elevación, en **dos capas**: una de contacto (1px, casi sin
 * desenfoque) que dibuja el borde del elemento, y una difusa y grande que da
 * la profundidad. Es lo que separa una superficie que "flota" de una que se
 * ve pegada con un manchón gris debajo — el tratamiento de una sola capa
 * difusa es el que envejeció peor del diseño anterior.
 *
 * La capa de contacto además cumple una función de accesibilidad: sostiene
 * sola el contraste del borde del control cuando la sombra difusa se pierde,
 * que es exactamente lo que le pasa a alguien con la sensibilidad al
 * contraste reducida. Por eso NO se puede bajar su opacidad "para que quede
 * más sutil": es lo que evita que el botón de confirmar la toma desaparezca.
 *
 * Se usa `boxShadow` y no los `shadow*` de siempre porque los viejos **no
 * funcionan en Android** (ahí sólo pesa `elevation`, que es una sola capa y
 * no acepta color). `boxShadow` admite varias sombras compuestas y anda en
 * las dos plataformas, pero **requiere la New Architecture** — que este
 * proyecto ya usa — y Android 9 o superior.
 */
export const shadows = {
  /**
   * Superficie extruida. Los cuatro valores salen tal cual del generador
   * (design.dev/tools/neumorphism, raised / light / dist 12 / blur 36 /
   * intensity 7): las dos sombras grandes dan el volumen, y las dos `inset`
   * de 1px son el filo que impide que el borde quede completamente difuso.
   * Ese filo es lo único que sostiene el contorno de la tarjeta, así que no
   * se toca.
   */
  card: {
    boxShadow: 'inset 1px 1px 1px rgba(255, 255, 255, 0.70), inset -1px -1px 1px rgba(156, 165, 178, 0.35), 12px 12px 36px rgba(156, 165, 178, 0.58), -12px -12px 36px rgba(251, 252, 253, 0.81)',
  },
  /**
   * Los botones de acción conservan su relleno de color. La referencia del
   * generador no incluye ningún botón de acción sobre fondo de color, y
   * pintarlos del color del fondo dejaría sin marcar lo único de la pantalla
   * que hay que encontrar rápido.
   */
  buttonPrimary: {
    boxShadow: '0px 1px 2px rgba(37, 99, 235, 0.40), 0px 10px 22px rgba(37, 99, 235, 0.28)',
  },
  buttonSuccess: {
    boxShadow: '0px 1px 2px rgba(21, 128, 61, 0.40), 0px 10px 22px rgba(21, 128, 61, 0.28)',
  },
  /** Hundido — la pastilla y las fotos van "dentro" del material. */
  pillShowcase: {
    boxShadow: 'inset 6px 6px 18px rgba(156, 165, 178, 0.68), inset -6px -6px 18px rgba(251, 252, 253, 0.81)',
  },
} as const;

/**
 * Sombra extruida derivada de CUALQUIER color de base, con la misma geometría
 * que `shadows.card` (12px de distancia, 36px de desenfoque, filo `inset` de
 * 1px).
 *
 * Existe por el pastillero: esa pantalla tiñe el fondo según el turno —
 * celeste a la mañana, ámbar a la tarde, índigo de noche — y el neumorfismo
 * exige que la superficie sea del MISMO color que el fondo sobre el que se
 * apoya. Una sombra gris fija sobre fondo ámbar se ve sucia, y una tarjeta
 * `#DDE3EC` sobre índigo vuelve a ser una mancha clara: justo lo que el
 * estilo evita. Derivándola del turno, cada pantalla conserva su identidad y
 * el material es el mismo.
 */
export function extrudedShadow(base: string): { readonly boxShadow: string } {
  const luz = shadeColor(base, 7);
  const sombra = shadeColor(base, -9);
  return {
    boxShadow:
      `inset 1px 1px 1px rgba(255, 255, 255, 0.70), inset -1px -1px 1px rgba(0, 0, 0, 0.08), ` +
      `12px 12px 36px ${sombra}, -12px -12px 36px ${luz}`,
  };
}

/** La contracara hundida de `extrudedShadow` — un hueco en el mismo material. */
export function recessedShadow(base: string): { readonly boxShadow: string } {
  const luz = shadeColor(base, 7);
  const sombra = shadeColor(base, -9);
  return { boxShadow: `inset 6px 6px 18px ${sombra}, inset -6px -6px 18px ${luz}` };
}
