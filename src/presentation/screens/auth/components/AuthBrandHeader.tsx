import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { CapsuleLogo } from './CapsuleLogo';
import { AccessibleText } from '../../../design-system/AccessibleText';
import { colors, spacing } from '../../../design-system/tokens';
import { useStaggeredEntrance } from '../../../hooks/useStaggeredEntrance';

export interface AuthBrandHeaderProps {
  readonly title: string;
  readonly subtitle: string;
}

/** Logo + título + subtítulo, primeros dos pasos de la entrada escalonada (índices 0 y 1). */
export function AuthBrandHeader({ title, subtitle }: AuthBrandHeaderProps): React.JSX.Element {
  const logoStyle = useStaggeredEntrance(0);
  const textStyle = useStaggeredEntrance(1);

  return (
    <View style={styles.container}>
      <Animated.View style={logoStyle}>
        <CapsuleLogo />
      </Animated.View>
      <Animated.View style={[styles.textBlock, textStyle]}>
        <AccessibleText variant="title" bold color={colors.textPrimary} style={styles.centerText}>
          {title}
        </AccessibleText>
        <AccessibleText variant="small" color={colors.textSecondary} style={styles.centerText}>
          {subtitle}
        </AccessibleText>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: spacing.md },
  textBlock: { gap: spacing.xs },
  centerText: { textAlign: 'center' },
});
