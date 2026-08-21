import React from 'react';
import { Text, type TextProps, type TextStyle } from 'react-native';
import { colors, typography } from '../design-system/tokens';

export type AccessibleTextVariant = 'small' | 'body' | 'label' | 'title' | 'display';

export interface AccessibleTextProps extends TextProps {
  readonly variant?: AccessibleTextVariant;
  readonly color?: string;
  readonly bold?: boolean;
  readonly children: React.ReactNode;
}

const VARIANT_STYLES: Record<AccessibleTextVariant, TextStyle> = {
  small: { fontSize: typography.small, lineHeight: typography.small * 1.4 },
  body: { fontSize: typography.body, lineHeight: typography.body * 1.4 },
  label: { fontSize: typography.label, lineHeight: typography.label * 1.3 },
  title: { fontSize: typography.title, lineHeight: typography.title * 1.25 },
  display: { fontSize: typography.display, lineHeight: typography.display * 1.15 },
};

/**
 * Wrapper de `Text` que fuerza tamaños del design system en vez de dejar
 * estilos ad-hoc por pantalla — la escala de accesibilidad es una decisión
 * de producto, no algo que cada componente deba redecidir.
 */
export function AccessibleText({
  variant = 'body',
  color = colors.textPrimary,
  bold = false,
  style,
  children,
  ...rest
}: AccessibleTextProps): React.JSX.Element {
  return (
    <Text
      style={[VARIANT_STYLES[variant], { color, fontWeight: bold ? '700' : '400' }, style]}
      // Respeta el ajuste de tamaño de fuente del sistema operativo (accesibilidad nativa),
      // no lo pisa — importante para usuarios que ya configuraron su OS.
      allowFontScaling
      maxFontSizeMultiplier={1.8}
      {...rest}
    >
      {children}
    </Text>
  );
}
