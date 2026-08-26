import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { authPalette } from '../theme/auth-theme';
import { radii, spacing } from '../../../design-system/tokens';
import { useStaggeredEntrance } from '../../../hooks/useStaggeredEntrance';

export interface AuthCardProps {
  readonly children: React.ReactNode;
  readonly staggerIndex?: number;
  readonly style?: StyleProp<ViewStyle>;
}

/**
 * Superficie contenedora del formulario: blanco casi opaco (no blur real —
 * sin librería de blur en el proyecto) con borde translúcido azulado y
 * elevación suave, que lee como "glass" sin sacrificar el contraste de
 * texto que exige el design system global.
 */
export function AuthCard({ children, staggerIndex = 2, style }: AuthCardProps): React.JSX.Element {
  const entrance = useStaggeredEntrance(staggerIndex, 28);

  return (
    <Animated.View style={[styles.card, entrance, style]}>
      <View style={styles.innerGlow} pointerEvents="none" />
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.xl,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderWidth: 1,
    borderColor: authPalette.cardBorder,
    padding: spacing.lg,
    gap: spacing.lg,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 4,
    overflow: 'hidden',
  },
  innerGlow: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: authPalette.glowSoft,
  },
});
