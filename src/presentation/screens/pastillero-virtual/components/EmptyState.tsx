import React from 'react';
import { View, StyleSheet } from 'react-native';
import { AccessibleText } from '../../../design-system/AccessibleText';
import { colors, spacing } from '../../../design-system/tokens';

/**
 * "No hay tomas pendientes" NO es un error — es el estado deseado la mayor
 * parte del día. El copy evita cualquier palabra que suene a alarma o falla.
 */
export function EmptyState(): React.JSX.Element {
  return (
    <View style={styles.container} accessible accessibilityRole="text">
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
  text: {
    textAlign: 'center',
  },
});
