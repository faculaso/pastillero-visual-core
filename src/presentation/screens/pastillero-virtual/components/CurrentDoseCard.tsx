import React from 'react';
import { View, StyleSheet } from 'react-native';
import type { PendingDoseView } from '../../../../application';
import { AccessibleText } from '../../../design-system/AccessibleText';
import { colors, radii, spacing } from '../../../design-system/tokens';
import { PillVisual } from './PillVisual';
import { VoiceGuidanceButton } from './VoiceGuidanceButton';
import { buildDoseVoiceMessage } from '../voice-message';

export interface CurrentDoseCardProps {
  readonly dose: PendingDoseView;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

function formatDosage(dose: PendingDoseView): string {
  const unit = dose.dosagePerTake.unit === 'UNIT' ? 'comprimido(s)' : dose.dosagePerTake.unit.toLowerCase();
  return `${dose.dosagePerTake.amount} ${unit}`;
}

/**
 * CU-02 paso 3: "El sistema renderiza el pastillero del turno mostrando la
 * forma/color del comprimido y la foto de la caja". El horario programado
 * se muestra en `label` grande arriba de todo: para un adulto mayor, "¿es
 * ahora?" suele ser la primera pregunta antes de "¿cuál pastilla es?".
 */
export function CurrentDoseCard({ dose }: CurrentDoseCardProps): React.JSX.Element {
  return (
    <View style={styles.card} accessible accessibilityRole="summary">
      <AccessibleText variant="label" color={colors.textSecondary}>
        Toma de las {formatTime(dose.scheduledAt)}
      </AccessibleText>

      <View style={styles.visualWrapper}>
        <PillVisual visualProfile={dose.visualProfile} size={180} medicationName={dose.medicationName} />
      </View>

      <AccessibleText variant="display" bold style={styles.medicationName}>
        {dose.medicationName}
      </AccessibleText>

      <AccessibleText variant="body" color={colors.textSecondary}>
        {formatDosage(dose)}
      </AccessibleText>

      <VoiceGuidanceButton text={buildDoseVoiceMessage(dose)} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
  },
  visualWrapper: {
    marginVertical: spacing.md,
  },
  medicationName: {
    textAlign: 'center',
  },
});
