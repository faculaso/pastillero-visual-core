import React from 'react';
import { View, StyleSheet } from 'react-native';
import { AccessibleText } from '../../../design-system/AccessibleText';
import { colors, radii, spacing } from '../../../design-system/tokens';

export interface EmptyStateProps {
  /** Mismos datos que alimentan la barra de progreso — evita una segunda fuente de verdad para "¿completó todo hoy?". */
  readonly dailyProgress?: { readonly totalScheduled: number; readonly totalTaken: number } | null;
}

/**
 * "No hay tomas pendientes" NO es un error — es el estado deseado la mayor
 * parte del día. El copy evita cualquier palabra que suene a alarma o
 * falla, y se diferencia en dos casos:
 *  - Completó TODAS las tomas programadas de hoy -> mensaje festivo con
 *    ilustración (el pedido explícito de "mensajes motivacionales").
 *  - Simplemente no hay ninguna toma pendiente ahora (o no hay ninguna
 *    programada hoy) -> mensaje neutro, sin sobre-celebrar algo que no pasó.
 */
export function EmptyState({ dailyProgress }: EmptyStateProps): React.JSX.Element {
  const completedAllToday = Boolean(
    dailyProgress && dailyProgress.totalScheduled > 0 && dailyProgress.totalTaken >= dailyProgress.totalScheduled,
  );

  if (completedAllToday) {
    return (
      <View style={styles.container} accessible accessibilityRole="text">
        <View style={styles.illustrationCircle}>
          <AccessibleText variant="display">🎉</AccessibleText>
        </View>
        <AccessibleText variant="title" bold color={colors.success} style={styles.text}>
          ¡Completaste todas tus tomas de hoy!
        </AccessibleText>
        <AccessibleText variant="body" color={colors.textSecondary} style={styles.text}>
          Excelente cuidado de tu salud. Te avisamos apenas empiece el próximo día.
        </AccessibleText>
      </View>
    );
  }

  return (
    <View style={styles.container} accessible accessibilityRole="text">
      <View style={styles.illustrationCircle}>
        <AccessibleText variant="display">🕊️</AccessibleText>
      </View>
      <AccessibleText variant="title" bold style={styles.text}>
        Por ahora no tenés tomas pendientes
      </AccessibleText>
      <AccessibleText variant="body" color={colors.textSecondary} style={styles.text}>
        Te avisamos apenas sea la hora de la próxima.
      </AccessibleText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  illustrationCircle: {
    width: 120,
    height: 120,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  text: {
    textAlign: 'center',
  },
});
