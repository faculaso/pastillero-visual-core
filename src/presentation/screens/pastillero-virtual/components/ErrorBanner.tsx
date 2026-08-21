import React from 'react';
import { View, StyleSheet } from 'react-native';
import { AccessibleText } from '../../../design-system/AccessibleText';
import { AccessibleButton } from '../../../design-system/AccessibleButton';
import { colors, radii, spacing } from '../../../design-system/tokens';

export interface ErrorBannerProps {
  readonly message: string;
  readonly onDismiss: () => void;
}

export function ErrorBanner({ message, onDismiss }: ErrorBannerProps): React.JSX.Element {
  return (
    <View style={styles.container} accessibilityRole="alert" accessible accessibilityLiveRegion="assertive">
      <AccessibleText variant="body" color={colors.critical} bold style={styles.text}>
        {message}
      </AccessibleText>
      <AccessibleButton label="Entendido" variant="secondary" onPress={onDismiss} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.criticalBackground,
    borderRadius: radii.md,
    padding: spacing.lg,
    gap: spacing.md,
  },
  text: {
    textAlign: 'center',
  },
});
