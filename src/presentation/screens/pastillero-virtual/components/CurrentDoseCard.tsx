import React from 'react';
import { View, StyleSheet } from 'react-native';
import type { PendingDoseView } from '../../../../application';
import { AccessibleText } from '../../../design-system/AccessibleText';
import { colors, radii, spacing } from '../../../design-system/tokens';
import { getTimeOfDayTheme } from '../../../utils/time-of-day-theme';
import { PillVisual } from './PillVisual';
import { InstructionBadge } from './InstructionBadge';
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
 *
 * El fondo de la tarjeta cambia según el TURNO (mañana/tarde/noche,
 * derivado de `dose.scheduledAt`) — refuerzo visual ambiental, no solo
 * informativo: a esta hora del día, con esta luz, corresponde esta toma.
 */
export function CurrentDoseCard({ dose }: CurrentDoseCardProps): React.JSX.Element {
  const theme = getTimeOfDayTheme(dose.scheduledAt);

  return (
    <View
      style={[styles.card, { backgroundColor: theme.background }]}
      accessible
      accessibilityRole="summary"
    >
      <View style={styles.periodBadge}>
        <AccessibleText variant="small" color={colors.textPrimary} bold>
          {theme.emoji} {theme.label}
        </AccessibleText>
      </View>

      <AccessibleText variant="label" color={theme.accentText}>
        Toma de las {formatTime(dose.scheduledAt)}
      </AccessibleText>

      <View style={styles.visualWrapper}>
        <PillVisual visualProfile={dose.visualProfile} size={180} medicationName={dose.medicationName} />
      </View>

      <AccessibleText variant="display" bold color={theme.accentText} style={styles.medicationName}>
        {dose.medicationName}
      </AccessibleText>

      <AccessibleText variant="body" color={theme.accentText} style={styles.dosageText}>
        {formatDosage(dose)}
      </AccessibleText>

      <InstructionBadge theme={theme} />

      <VoiceGuidanceButton text={buildDoseVoiceMessage(dose)} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
  },
  periodBadge: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
  },
  visualWrapper: {
    marginVertical: spacing.md,
  },
  medicationName: {
    textAlign: 'center',
  },
  dosageText: {
    opacity: 0.85,
  },
});
