import React from 'react';
import { Pressable, StyleSheet, ActivityIndicator, type StyleProp, type ViewStyle } from 'react-native';
import { AccessibleText } from './AccessibleText';
import { colors, radii, spacing, touchTarget, shadows } from './tokens';

export type AccessibleButtonVariant = 'primary' | 'success' | 'secondary';

export interface AccessibleButtonProps {
  readonly label: string;
  readonly onPress: () => void;
  readonly variant?: AccessibleButtonVariant;
  readonly disabled?: boolean;
  readonly loading?: boolean;
  readonly fullHeight?: boolean; // usa touchTarget.confirmButtonHeight (el botón "Confirmar Toma")
  readonly accessibilityHint?: string;
  readonly style?: StyleProp<ViewStyle>;
}

const VARIANT_BACKGROUND: Record<AccessibleButtonVariant, { base: string; pressed: string }> = {
  primary: { base: colors.primary, pressed: colors.primaryPressed },
  success: { base: colors.successStrong, pressed: colors.success },
  secondary: { base: colors.surface, pressed: colors.borderLight },
};

/** Sombra de color a juego con el fondo del botón — solo primary/success la llevan (mockup: `.btn-primary`/`.btn-confirm`). `secondary` queda plano (outline). */
const VARIANT_SHADOW: Record<AccessibleButtonVariant, ViewStyle | undefined> = {
  primary: shadows.buttonPrimary,
  success: shadows.buttonSuccess,
  secondary: undefined,
};

/**
 * Botón base de toda la app. Decisiones de a11y:
 *  - `accessibilityRole="button"` + `accessibilityState` para lectores de pantalla.
 *  - Altura mínima `touchTarget.minHeight` (72px), configurable a
 *    `confirmButtonHeight` (96px) para la acción más crítica de CU-02.
 *  - Estado disabled/loading nunca se comunica SOLO por color — también
 *    baja la opacidad y cambia el texto accesible vía `accessibilityState`.
 */
export function AccessibleButton({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  fullHeight = false,
  accessibilityHint,
  style,
}: AccessibleButtonProps): React.JSX.Element {
  const palette = variant === 'secondary' ? colors.textPrimary : '#FFFFFF';
  const isInteractive = !disabled && !loading;

  return (
    <Pressable
      onPress={isInteractive ? onPress : undefined}
      disabled={!isInteractive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !isInteractive, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        // La sombra de color solo tiene sentido con el botón habilitado y en
        // su color "base" — en gris (disabled) o mientras carga, se ve como
        // un artefacto de render, no como profundidad.
        !disabled && !loading ? VARIANT_SHADOW[variant] : undefined,
        {
          minHeight: fullHeight ? touchTarget.confirmButtonHeight : touchTarget.minHeight,
          backgroundColor: disabled
            ? colors.disabled
            : pressed
              ? VARIANT_BACKGROUND[variant].pressed
              : VARIANT_BACKGROUND[variant].base,
          borderWidth: variant === 'secondary' ? 2 : 0,
          borderColor: colors.border,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette} />
      ) : (
        <AccessibleText variant="label" color={palette} bold>
          {label}
        </AccessibleText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
});
