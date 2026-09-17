import React from 'react';
import { View, StyleSheet } from 'react-native';
import type { TimeOfDayTheme } from '../../../utils/time-of-day-theme';
import { AccessibleText } from '../../../design-system/AccessibleText';
import { colors, radii, spacing, shadows } from '../../../design-system/tokens';

export interface InstructionBadgeProps {
  readonly theme: TimeOfDayTheme;
}

/**
 * RF-02 ampliado: ícono ilustrado + label del contexto de toma ("con agua",
 * "después de comer", "antes de dormir").
 *
 * Fila EN LÍNEA, no un stack centrado: apilado (círculo de 56px sobre el
 * texto) gastaba ~100px de alto justo arriba de la tarjeta de la toma y
 * empujaba el botón de confirmar fuera de la pantalla. La instrucción es
 * contexto de la pastilla, no un titular — ocupa una línea y cede el
 * espacio vertical al comprimido, que es el foco real de la pantalla.
 */
export function InstructionBadge({ theme }: InstructionBadgeProps): React.JSX.Element {
  return (
    <View
      style={[styles.container, { backgroundColor: theme.chipBackground, borderColor: theme.chipBorder }]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={theme.instructionLabel}
    >
      <View style={styles.circle}>
        <AccessibleText variant="small">{theme.instructionEmoji}</AccessibleText>
      </View>
      <AccessibleText variant="small" bold color={theme.accentText}>
        {theme.instructionLabel}
      </AccessibleText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingLeft: spacing.xs,
    paddingRight: spacing.md,
    paddingVertical: spacing.xs,
  },
  circle: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    // Blanca siempre, sin importar el tinte de turno del fondo de pantalla
    // (mañana/tarde/noche) — necesita contraste constante contra los tres.
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.pillShowcase,
  },
});
