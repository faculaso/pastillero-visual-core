import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { AccessibleText } from '../../../design-system/AccessibleText';
import { radii, spacing, touchTarget } from '../../../design-system/tokens';
import { authPalette } from '../theme/auth-theme';
import { PRESS_SPRING } from '../../../design-system/motion';
import { vibrateTap } from '../../../utils/haptics';
import { useStaggeredEntrance } from '../../../hooks/useStaggeredEntrance';

export interface PrimaryAuthButtonProps {
  readonly label: string;
  readonly onPress: () => void;
  readonly disabled?: boolean;
  readonly loading?: boolean;
  readonly staggerIndex?: number;
  readonly accessibilityHint?: string;
}

/**
 * Botón principal del flujo de auth: mismo contrato de accesibilidad que
 * `AccessibleButton` (rol, label, `accessibilityState`, altura mínima de
 * `touchTarget.confirmButtonHeight`) pero con feedback de press (escala +
 * vibración corta) y acento clínico en vez del azul de acción global.
 */
export function PrimaryAuthButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  staggerIndex = 5,
  accessibilityHint,
}: PrimaryAuthButtonProps): React.JSX.Element {
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
        accessibilityLabel={label}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled: !isInteractive, busy: loading }}
      >
        <Animated.View
          style={[
            styles.base,
            pressStyle,
            { backgroundColor: disabled ? '#94A3B8' : authPalette.clinicalBlue, opacity: loading ? 0.9 : 1 },
          ]}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <AccessibleText variant="label" color="#FFFFFF" bold>
              {label}
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
    shadowColor: authPalette.clinicalBlue,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 6,
  },
});
