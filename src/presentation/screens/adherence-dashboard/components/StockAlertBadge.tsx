import React from 'react';
import { View, StyleSheet } from 'react-native';
import { StockAlertLevel } from '../../../../domain';
import { AccessibleText } from '../../../design-system/AccessibleText';
import { colors, radii, spacing } from '../../../design-system/tokens';

export interface StockAlertBadgeProps {
  readonly level: StockAlertLevel;
}

const CONFIG: Record<StockAlertLevel, { label: string; bg: string; fg: string }> = {
  [StockAlertLevel.NORMAL]: { label: 'Stock normal', bg: colors.successBackground, fg: colors.success },
  [StockAlertLevel.WARNING]: { label: 'Reponer pronto', bg: colors.warningBackground, fg: colors.warning },
  [StockAlertLevel.CRITICAL]: { label: 'Stock crítico — reponer ahora', bg: colors.criticalBackground, fg: colors.critical },
};

/** Nunca comunica el estado solo por color: siempre acompaña con texto explícito (a11y, daltonismo). */
export function StockAlertBadge({ level }: StockAlertBadgeProps): React.JSX.Element {
  const { label, bg, fg } = CONFIG[level];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]} accessibilityRole="text">
      <AccessibleText variant="small" color={fg} bold>
        {label}
      </AccessibleText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
  },
});
