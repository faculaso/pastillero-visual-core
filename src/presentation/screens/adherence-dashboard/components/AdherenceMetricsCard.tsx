import React from 'react';
import { View, StyleSheet } from 'react-native';
import type { AdherenceMetrics } from '../../../../domain';
import { AccessibleText } from '../../../design-system/AccessibleText';
import { colors, radii, spacing, shadows } from '../../../design-system/tokens';
import { getAdherenceDisplay, formatAdherencePercentage } from '../../../utils/adherence-display';

export interface AdherenceMetricsCardProps {
  readonly metrics: AdherenceMetrics;
}

function formatDaysRemaining(days: number): string {
  if (!Number.isFinite(days)) return 'Sin consumo registrado';
  const enteros = Math.floor(days);
  // "0 día(s)" no es una frase: cuando no queda nada, decilo.
  if (enteros === 0) return 'Se acabó';
  return enteros === 1 ? '1 día' : `${enteros} días`;
}

/** CU-03 pasos 1-3: % de adherencia calculado y días restantes de stock, lado a lado. */
export function AdherenceMetricsCard({ metrics }: AdherenceMetricsCardProps): React.JSX.Element {
  const adherencia = getAdherenceDisplay(metrics.adherencePercentage);

  return (
    <View style={styles.row}>
      <View style={styles.card}>
        <AccessibleText variant="small" color={colors.textSecondary}>
          Adherencia
        </AccessibleText>
        <AccessibleText variant="title" bold color={adherencia.color}>
          {formatAdherencePercentage(metrics.adherencePercentage)}
        </AccessibleText>
        <View style={[styles.nivel, { backgroundColor: adherencia.background, borderColor: adherencia.border }]}>
          <AccessibleText variant="small" bold color={adherencia.color}>
            {adherencia.label}
          </AccessibleText>
        </View>
        <AccessibleText variant="small" color={colors.textSecondary}>
          {metrics.totalTaken} de {metrics.totalScheduled} tomas
        </AccessibleText>
      </View>

      <View style={styles.card}>
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
  nivel: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.lg,
    gap: spacing.xs,
    ...shadows.card,
  },
});
