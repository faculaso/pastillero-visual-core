import { Appearance } from 'react-native';
import { shadeColor } from '../utils/shade-color';
import { PALETA_CLARA, PALETA_OSCURA, type Paleta } from './palettes';

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
 * Tratamiento visual: superficies extruidas (neumorfismo) del MISMO color que
 * el fondo, separadas por la sombra y no por un relleno distinto.
 * `spacing`, `typography` y `touchTarget` NO dependen del tema: son la parte
 * que protege la usabilidad real (texto grande, targets de 72px),
 * independiente de qué tan "pulida" o de qué color se vea la app.
 */

/**
 * El tema se resuelve UNA VEZ, cuando carga este módulo.
 *
 * No es una preferencia estética: en React Native no hay variables CSS.
 * `StyleSheet.create` copia el valor del color en el momento en que se
 * ejecuta el módulo, y los 58 `StyleSheet.create` de la app corren al
 * arrancar. Mutar la paleta después no repinta nada — habría que convertir
 * cada hoja de estilos en una función del tema y enhebrar un hook por los 62
 * archivos que importan `colors`.
 *
 * Consecuencia práctica, que conviene saber antes de reportarlo como bug: si
 * alguien cambia el tema del teléfono con la app abierta, la app NO cambia
 * hasta que se cierra y se vuelve a abrir. Tampoco la recrea Android por su
 * cuenta, porque el `AndroidManifest` del host declara `uiMode` dentro de
 * `configChanges` y con eso se hace cargo del cambio sin reiniciar la
 * actividad.
 */
export const esquemaOscuro: boolean = Appearance.getColorScheme() === 'dark';

export const colors: Paleta = esquemaOscuro ? PALETA_OSCURA : PALETA_CLARA;

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

interface JuegoDeSombras {
  readonly card: { readonly boxShadow: string };
  readonly buttonPrimary: { readonly boxShadow: string };
  readonly buttonSuccess: { readonly boxShadow: string };
  readonly pillShowcase: { readonly boxShadow: string };
}

/**
 * Sombras de elevación, en **dos capas**: una de contacto (1px, casi sin
 * desenfoque) que dibuja el borde del elemento, y una difusa y grande que da
 * la profundidad.
 *
 * La capa de contacto cumple una función de accesibilidad: sostiene sola el
 * contorno del control cuando la sombra difusa se pierde, que es exactamente
 * lo que le pasa a alguien con la sensibilidad al contraste reducida. Por eso
 * NO se puede bajar su opacidad "para que quede más sutil": es lo que evita
 * que el botón de confirmar la toma desaparezca.
 *
 * Se usa `boxShadow` y no los `shadow*` de siempre porque los viejos **no
 * funcionan en Android** (ahí sólo pesa `elevation`, que es una sola capa y
 * no acepta color). `boxShadow` admite varias sombras compuestas y anda en
 * las dos plataformas, pero **requiere la New Architecture** — que este
 * proyecto ya usa — y Android 9 o superior.
 */
const SOMBRAS_CLARAS: JuegoDeSombras = {
  card: {
    boxShadow:
      'inset 1px 1px 1px rgba(255, 255, 255, 0.70), inset -1px -1px 1px rgba(156, 165, 178, 0.35), 12px 12px 36px rgba(156, 165, 178, 0.58), -12px -12px 36px rgba(251, 252, 253, 0.81)',
  },
  buttonPrimary: {
    boxShadow: '0px 1px 2px rgba(37, 99, 235, 0.40), 0px 10px 22px rgba(37, 99, 235, 0.28)',
  },
  buttonSuccess: {
    boxShadow: '0px 1px 2px rgba(21, 128, 61, 0.40), 0px 10px 22px rgba(21, 128, 61, 0.28)',
  },
  pillShowcase: {
    boxShadow:
      'inset 6px 6px 18px rgba(156, 165, 178, 0.68), inset -6px -6px 18px rgba(251, 252, 253, 0.81)',
  },
};

/**
 * En oscuro la sombra no se "aclara": se invierte el reparto. La luz de
 * arriba a la izquierda es mucho más tenue (un fondo oscuro no refleja como
 * uno claro, y un borde blanco marcado se ve como un filo de neón), y la
 * sombra de abajo a la derecha es más profunda y más opaca, porque sobre
 * oscuro un gris medio no lee como sombra.
 */
const SOMBRAS_OSCURAS: JuegoDeSombras = {
  card: {
    boxShadow:
      'inset 1px 1px 1px rgba(255, 255, 255, 0.07), inset -1px -1px 1px rgba(0, 0, 0, 0.45), 12px 12px 36px rgba(17, 19, 25, 0.80), -12px -12px 36px rgba(62, 70, 88, 0.50)',
  },
  buttonPrimary: {
    boxShadow: '0px 1px 2px rgba(59, 130, 246, 0.55), 0px 10px 22px rgba(59, 130, 246, 0.30)',
  },
  buttonSuccess: {
    boxShadow: '0px 1px 2px rgba(22, 163, 74, 0.55), 0px 10px 22px rgba(22, 163, 74, 0.30)',
  },
  pillShowcase: {
    boxShadow:
      'inset 6px 6px 18px rgba(17, 19, 25, 0.85), inset -6px -6px 18px rgba(62, 70, 88, 0.50)',
  },
};

export const shadows: JuegoDeSombras = esquemaOscuro ? SOMBRAS_OSCURAS : SOMBRAS_CLARAS;

/**
 * Sombra extruida derivada de CUALQUIER color de base, con la misma geometría
 * que `shadows.card` (12px de distancia, 36px de desenfoque, filo `inset` de
 * 1px).
 *
 * Existe por el pastillero: esa pantalla tiñe el fondo según el turno, y el
 * neumorfismo exige que la superficie sea del MISMO color que el fondo sobre
 * el que se apoya. Una sombra gris fija sobre fondo ámbar se ve sucia.
 * Derivándola del turno, cada pantalla conserva su identidad y el material es
 * el mismo.
 */
export function extrudedShadow(base: string): { readonly boxShadow: string } {
  const luz = shadeColor(base, esquemaOscuro ? 9 : 7);
  const sombra = shadeColor(base, esquemaOscuro ? -14 : -9);
  const filoClaro = esquemaOscuro ? 'rgba(255, 255, 255, 0.07)' : 'rgba(255, 255, 255, 0.70)';
  const filoOscuro = esquemaOscuro ? 'rgba(0, 0, 0, 0.45)' : 'rgba(0, 0, 0, 0.08)';
  return {
    boxShadow:
      `inset 1px 1px 1px ${filoClaro}, inset -1px -1px 1px ${filoOscuro}, ` +
      `12px 12px 36px ${sombra}, -12px -12px 36px ${luz}`,
  };
}

/** La contracara hundida de `extrudedShadow` — un hueco en el mismo material. */
export function recessedShadow(base: string): { readonly boxShadow: string } {
  const luz = shadeColor(base, esquemaOscuro ? 9 : 7);
  const sombra = shadeColor(base, esquemaOscuro ? -14 : -9);
  return { boxShadow: `inset 6px 6px 18px ${sombra}, inset -6px -6px 18px ${luz}` };
}
