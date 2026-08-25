import React from 'react';
import { View, StyleSheet } from 'react-native';
import { AccessibleText } from '../../../design-system/AccessibleText';
import { colors, radii, spacing, shadows } from '../../../design-system/tokens';

/**
 * Banner de aliento cuando todavía no hay ningún tratamiento — ya no tiene
 * botón propio: el pastillero (la grilla, siempre visible debajo) es el
 * único punto de entrada para agregar, tocando el casillero del día/turno
 * que corresponda.
 */
export function EmptyWeek(): React.JSX.Element {
  return (
    <View style={styles.container} accessible accessibilityRole="text">
      <View style={styles.illustrationCircle}>
        <AccessibleText variant="display">📋</AccessibleText>
      </View>
      <AccessibleText variant="title" bold style={styles.text}>
        Todavía no registraste ningún tratamiento
      </AccessibleText>
      <AccessibleText variant="body" color={colors.textSecondary} style={styles.text}>
        Tocá un casillero de tu semana, abajo, para agregar el primero.
      </AccessibleText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  illustrationCircle: {
    width: 96,
    height: 96,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    ...shadows.pillShowcase,
  },
  text: { textAlign: 'center' },
});
