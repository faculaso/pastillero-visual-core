import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { AccessibleText } from '../../../design-system/AccessibleText';
import { colors, radii, spacing, shadows, touchTarget } from '../../../design-system/tokens';
import { PRESS_SPRING } from '../../../design-system/motion';
import { vibrateTap } from '../../../utils/haptics';
import { useStaggeredEntrance } from '../../../hooks/useStaggeredEntrance';

export interface ConfirmDoseButtonProps {
  readonly onPress: () => void;
  readonly disabled?: boolean;
  readonly loading?: boolean;
  readonly staggerIndex?: number;
}

/**
 * El botón más importante de CU-02 (paso 4) — mismo contrato de
 * accesibilidad que `AccessibleButton` variant="success" (rol, label,
 * `accessibilityState`, `touchTarget.confirmButtonHeight`), con la misma
 * micro-animación de press (`scale: 0.97` + vibración corta) que
 * `PrimaryAuthButton` en el flujo de auth.
 */
export function ConfirmDoseButton({
  onPress,
  disabled = false,
  loading = false,
  staggerIndex = 4,
}: ConfirmDoseButtonProps): React.JSX.Element {
  const isInteractive = !disabled && !loading;
  const scale = useSharedValue(1);
  const entrance = useStaggeredEntrance(staggerIndex);

  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  function handlePressIn(): void {
    if (!isInteractive) return;
    scale.value = withSpring(0.97, PRESS_SPRING);
  }

  function handlePressOut(): void {
    scale.value = withSpring(1, PRESS_SPRING);
  }

  function handlePress(): void {
    vibrateTap();
    onPress();
  }

  return (
    <Animated.View style={entrance}>
      <Pressable
        onPress={isInteractive ? handlePress : undefined}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={!isInteractive}
        accessibilityRole="button"
        accessibilityLabel="Confirmar Toma"
        accessibilityHint="Marca esta toma como completada"
        accessibilityState={{ disabled: !isInteractive, busy: loading }}
      >
        <Animated.View
          style={[
            styles.base,
            pressStyle,
            { backgroundColor: disabled ? colors.disabled : colors.successStrong, opacity: loading ? 0.9 : 1 },
          ]}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <AccessibleText variant="label" color="#FFFFFF" bold>
              Confirmar Toma
            </AccessibleText>
          )}
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: touchTarget.confirmButtonHeight,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    ...shadows.buttonSuccess,
  },
});
