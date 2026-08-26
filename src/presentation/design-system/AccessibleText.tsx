import React from 'react';
import { PixelRatio, Text, type TextProps } from 'react-native';
import { colors, typography } from '../design-system/tokens';

export type AccessibleTextVariant = 'small' | 'body' | 'label' | 'title' | 'display';

export interface AccessibleTextProps extends TextProps {
  readonly variant?: AccessibleTextVariant;
  readonly color?: string;
  readonly bold?: boolean;
  readonly children: React.ReactNode;
}

const VARIANT_SIZE: Record<AccessibleTextVariant, number> = {
  small: typography.small,
  body: typography.body,
  label: typography.label,
  title: typography.title,
  display: typography.display,
};

/** Múltiplo de `fontSize` que define el alto de línea de cada variante. */
const VARIANT_LINE_HEIGHT_RATIO: Record<AccessibleTextVariant, number> = {
  small: 1.4,
  body: 1.4,
  label: 1.3,
  title: 1.25,
  display: 1.15,
};

/** Mismo tope que `maxFontSizeMultiplier` más abajo — ver por qué en el docblock. */
const MAX_FONT_SCALE = 1.8;

/**
 * Wrapper de `Text` que fuerza tamaños del design system en vez de dejar
 * estilos ad-hoc por pantalla — la escala de accesibilidad es una decisión
 * de producto, no algo que cada componente deba redecidir.
 *
 * `lineHeight` se recalcula en cada render (no es un valor fijo) porque RN
 * escala `fontSize` solo automáticamente con el ajuste de "texto grande" del
 * sistema operativo (`allowFontScaling`) — NO escala `lineHeight` de la
 * misma forma. Con el ajuste de accesibilidad del OS en un valor alto (algo
 * esperable en el perfil de usuario de esta app), el glifo real terminaba
 * más alto que la línea declarada, y cualquier `View` que envolviera el
 * texto se inflaba para no recortarlo (bug real visto en `DailyProgressBar`:
 * la fila de texto quedaba muchísimo más alta que la barra de progreso de
 * arriba, pisándola). Se multiplica acá por el MISMO tope que
 * `maxFontSizeMultiplier` para que ambos números describan la misma escala
 * real que termina aplicando RN.
 *
 * `includeFontPadding: false` (Android): por default, `TextView` reserva
 * padding vertical extra sobre/bajo el glifo para acentos y descendentes de
 * la fuente del sistema — con algunas fuentes (la de MIUI, en particular)
 * ese padding es grande y termina siendo mucho más alto que el `lineHeight`
 * declarado, sin que ningún estilo de RN lo delate (el fondo/color del
 * propio `Text` sí respeta el `lineHeight`, pero el alto que reservan sus
 * ancestros al medirlo con tamaño "auto" usa la métrica nativa, más
 * grande). Sin este flag, cualquier `View` que envuelva un `AccessibleText`
 * con altura automática queda con aire de sobra debajo del texto — se vio
 * en `DailyProgressBar`, con la fila de texto mucho más alta que la barra
 * de arriba, pisándola.
 */
export function AccessibleText({
  variant = 'body',
  color = colors.textPrimary,
  bold = false,
  style,
  children,
  ...rest
}: AccessibleTextProps): React.JSX.Element {
  const fontScale = Math.min(PixelRatio.getFontScale(), MAX_FONT_SCALE);
  const fontSize = VARIANT_SIZE[variant];
  const lineHeight = fontSize * VARIANT_LINE_HEIGHT_RATIO[variant] * fontScale;

  return (
    <Text
      style={[
        { fontSize, lineHeight, color, fontWeight: bold ? '700' : '400', includeFontPadding: false },
        style,
      ]}
      allowFontScaling
      maxFontSizeMultiplier={MAX_FONT_SCALE}
      {...rest}
    >
      {children}
    </Text>
  );
}
