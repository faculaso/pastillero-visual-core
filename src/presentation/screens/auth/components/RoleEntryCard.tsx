import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { AccessibleText } from '../../../design-system/AccessibleText';
import { colors, radii, spacing } from '../../../design-system/tokens';
import { authPalette } from '../theme/auth-theme';
import { PRESS_SPRING } from '../../../design-system/motion';
import { vibrateTap } from '../../../utils/haptics';

export interface RoleEntryCardProps {
  readonly label: string;
  readonly hint: string;
  /** `secondary` es la tarjeta de "activar el otro rol": misma forma, menos peso visual. */
  readonly variant?: 'primary' | 'secondary';
  readonly disabled?: boolean;
  readonly onPress: () => void;
}

/**
 * Hermana de `RoleOptionCard`, pero NO es una opción: tocarla entra.
 *
 * Por eso `accessibilityRole="button"` en vez de `"radio"` — en el registro
 * elegís un rol y después confirmás con "Crear cuenta"; acá el toque ya es
 * la acción, y anunciarlo como radio le prometería a un lector de pantalla
 * un paso de confirmación que no existe.
 */
export function RoleEntryCard({
  label,
  hint,
  variant = 'primary',
  disabled = false,
  onPress,
}: RoleEntryCardProps): React.JSX.Element {
  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  function handlePress(): void {
    vibrateTap();
    onPress();
  }

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      onPressIn={() => {
        scale.value = withSpring(0.98, PRESS_SPRING);
      }}
      onPressOut={() => {
        scale.value = withSpring(1, PRESS_SPRING);
      }}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityLabel={label}
      accessibilityHint={hint}
    >
      <Animated.View
        style={[
          styles.card,
          variant === 'primary' ? styles.cardPrimary : styles.cardSecondary,
          disabled && styles.cardDisabled,
          pressStyle,
        ]}
      >
        <View style={styles.texts}>
          <AccessibleText
            variant="label"
            bold
            color={variant === 'primary' ? authPalette.clinicalBlue : colors.textPrimary}
          >
            {label}
          </AccessibleText>
          <AccessibleText variant="small" color={colors.textSecondary}>
            {hint}
          </AccessibleText>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    // 72px de alto mínimo: mismo objetivo táctil que el resto de la app.
    minHeight: 72,
    justifyContent: 'center',
    borderWidth: 2,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  cardPrimary: { borderColor: authPalette.clinicalBlue, backgroundColor: authPalette.glowSoft },
  cardSecondary: { borderColor: authPalette.inputIdleBorder },
  cardDisabled: { opacity: 0.5 },
  texts: { gap: spacing.xs },
});
