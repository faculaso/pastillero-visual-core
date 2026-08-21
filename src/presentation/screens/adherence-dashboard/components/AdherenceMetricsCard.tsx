import React from 'react';
import { View, StyleSheet } from 'react-native';
import type { AdherenceMetrics } from '../../../../domain';
import { AccessibleText } from '../../../design-system/AccessibleText';
import { colors, radii, spacing } from '../../../design-system/tokens';

export interface AdherenceMetricsCardProps {
  readonly metrics: AdherenceMetrics;
}

function formatDaysRemaining(days: number): string {
  if (!Number.isFinite(days)) return 'Sin consumo registrado';
  return `${Math.floor(days)} día(s)`;
}

/** CU-03 pasos 1-3: % de adherencia calculado y días restantes de stock, lado a lado. */
export function AdherenceMetricsCard({ metrics }: AdherenceMetricsCardProps): React.JSX.Element {
  return (
    <View style={styles.row}>
      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <AccessibleText variant="small" color={colors.textSecondary}>
          Adherencia
        </AccessibleText>
        <AccessibleText variant="title" bold>
          {metrics.adherencePercentage}%
        </AccessibleText>
        <AccessibleText variant="small" color={colors.textSecondary}>
          {metrics.totalTaken} de {metrics.totalScheduled} tomas
        </AccessibleText>
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <AccessibleText variant="small" color={colors.textSecondary}>
          Stock restante
        </AccessibleText>
        <AccessibleText variant="title" bold>
          {formatDaysRemaining(metrics.estimatedDaysRemaining)}
        </AccessibleText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md },
  card: {
    flex: 1,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.xs,
  },
});
