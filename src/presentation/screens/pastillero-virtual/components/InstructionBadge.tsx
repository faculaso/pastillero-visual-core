import React from 'react';
import { View, StyleSheet } from 'react-native';
import type { TimeOfDayTheme } from '../../../utils/time-of-day-theme';
import { AccessibleText } from '../../../design-system/AccessibleText';
import { colors, radii, spacing, shadows } from '../../../design-system/tokens';

export interface InstructionBadgeProps {
  readonly theme: TimeOfDayTheme;
}

/** RF-02 ampliado: ícono ilustrado + fondo circular para el contexto de toma ("con agua", "después de comer", "antes de dormir"). */
export function InstructionBadge({ theme }: InstructionBadgeProps): React.JSX.Element {
  return (
    <View style={styles.container} accessible accessibilityRole="text" accessibilityLabel={theme.instructionLabel}>
      <View style={styles.circle}>
        <AccessibleText variant="title">{theme.instructionEmoji}</AccessibleText>
      </View>
      <AccessibleText variant="small" color={theme.accentText}>
        {theme.instructionLabel}
      </AccessibleText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: spacing.xs },
  circle: {
    width: 56,
    height: 56,
    borderRadius: radii.pill,
    // Blanca siempre, sin importar el tinte de turno del fondo de pantalla
    // (mañana/tarde/noche) — necesita contraste constante contra los tres.
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.border,
    ...shadows.pillShowcase,
  },
});
