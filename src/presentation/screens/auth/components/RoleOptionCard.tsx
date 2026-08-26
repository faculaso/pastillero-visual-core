import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { AccessibleText } from '../../../design-system/AccessibleText';
import { colors, radii, spacing } from '../../../design-system/tokens';
import { authPalette } from '../theme/auth-theme';
import { PRESS_SPRING } from '../../../design-system/motion';
import { vibrateTap } from '../../../utils/haptics';

export interface RoleOptionCardProps {
  readonly label: string;
  readonly hint: string;
  readonly selected: boolean;
  readonly onPress: () => void;
}

export function RoleOptionCard({ label, hint, selected, onPress }: RoleOptionCardProps): React.JSX.Element {
  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  function handlePress(): void {
    vibrateTap();
    onPress();
  }

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={() => {
        scale.value = withSpring(0.98, PRESS_SPRING);
      }}
      onPressOut={() => {
        scale.value = withSpring(1, PRESS_SPRING);
      }}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
    >
      <Animated.View style={[styles.card, selected && styles.cardSelected, pressStyle]}>
        <AccessibleText variant="label" bold color={selected ? authPalette.clinicalBlue : colors.textPrimary}>
          {label}
        </AccessibleText>
        <AccessibleText variant="small" color={colors.textSecondary}>
          {hint}
        </AccessibleText>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 2,
    borderColor: authPalette.inputIdleBorder,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.xs,
  },
  cardSelected: {
    borderColor: authPalette.clinicalBlue,
    backgroundColor: authPalette.glowSoft,
  },
});
