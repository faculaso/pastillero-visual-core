import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import type { WeekDoseView } from '../../../../application';
import { DoseStatus } from '../../../../domain';
import { AccessibleText } from '../../../design-system/AccessibleText';
import { colors, radii, spacing, touchTarget } from '../../../design-system/tokens';
import { PRESS_SPRING } from '../../../design-system/motion';
import { vibrateTap } from '../../../utils/haptics';

export interface TurnoRowProps {
  readonly emoji: string;
  readonly label: string;
  readonly doses: readonly WeekDoseView[];
  /** Solo las filas de HOY con una toma pendiente son tocables — nunca se duplica el flujo de confirmación acá. */
  readonly interactive: boolean;
  readonly isFutureDay: boolean;
  readonly onPress?: () => void;
}

function summarize(
  doses: readonly WeekDoseView[],
  isFutureDay: boolean,
): { readonly label: string; readonly color: string; readonly background: string } {
  const total = doses.length;
  const taken = doses.filter((d) => d.status === DoseStatus.TAKEN).length;
  const missed = doses.filter((d) => d.status === DoseStatus.MISSED).length;

  if (taken === total) {
    return { label: total > 1 ? 'Tomadas' : 'Tomada', color: colors.success, background: colors.successBackground };
  }
  if (isFutureDay) return { label: 'Programada', color: colors.textSecondary, background: colors.surfaceSubtle };
  if (missed === total) {
    return { label: total > 1 ? 'No tomadas' : 'No tomada', color: colors.critical, background: colors.criticalBackground };
  }
  return { label: 'Pendiente', color: colors.warning, background: colors.warningBackground };
}

/**
 * Fila de turno del día — nunca más chica que `touchTarget.minHeight` (72px):
 * a diferencia de la grilla del Cuidador, esta pantalla la ve el Adulto
 * Mayor, así que respeta el mismo mínimo táctil que el resto de sus
 * pantallas. Un turno sin dosis programadas queda visualmente apagado.
 */
export function TurnoRow({ emoji, label, doses, interactive, isFutureDay, onPress }: TurnoRowProps): React.JSX.Element {
  const hasDoses = doses.length > 0;
  const status = hasDoses ? summarize(doses, isFutureDay) : null;

  const content = (
    <>
      <AccessibleText variant="body" bold color={hasDoses ? colors.textPrimary : colors.textSecondary}>
        {emoji} {label}
      </AccessibleText>
      {hasDoses ? (
        <View style={styles.meds}>
          {doses.map((dose) => (
            <View key={dose.doseId} style={styles.medRow}>
              <View style={[styles.dot, { backgroundColor: dose.visualProfile.color }]} />
              <AccessibleText variant="small" color={colors.textSecondary}>
                {dose.medicationName}
              </AccessibleText>
            </View>
          ))}
        </View>
      ) : (
        <AccessibleText variant="small" color={colors.textSecondary}>
          Sin dosis programadas
        </AccessibleText>
      )}
      {status ? (
        <View style={[styles.statusChip, { backgroundColor: status.background }]}>
          <AccessibleText variant="small" bold color={status.color}>
            {status.label}
          </AccessibleText>
        </View>
      ) : null}
    </>
  );

  if (interactive && onPress) {
    return <InteractiveRow label={label} onPress={onPress}>{content}</InteractiveRow>;
  }

  return (
    <View style={[styles.row, hasDoses ? styles.rowActive : styles.rowEmpty]} accessible accessibilityRole="text">
      {content}
    </View>
  );
}

interface InteractiveRowProps {
  readonly label: string;
  readonly onPress: () => void;
  readonly children: React.ReactNode;
}

/** Escala + vibración corta al tocar — misma micro-interacción que `ConfirmDoseButton`, la acción a la que lleva esta fila. */
function InteractiveRow({ label, onPress, children }: InteractiveRowProps): React.JSX.Element {
  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  function handlePress(): void {
    vibrateTap();
    onPress();
  }

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={() => {
        scale.value = withSpring(0.98, PRESS_SPRING);
      }}
      onPressOut={() => {
        scale.value = withSpring(1, PRESS_SPRING);
      }}
      accessibilityRole="button"
      accessibilityLabel={`${label}, pendiente — tocá para ir a confirmarla`}
    >
      <Animated.View style={[styles.row, styles.rowActive, pressStyle]}>{children}</Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: touchTarget.minHeight,
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.md,
    gap: 4,
    justifyContent: 'center',
  },
  rowActive: {
    backgroundColor: colors.surface,
    borderColor: colors.borderLight,
  },
  rowEmpty: {
    backgroundColor: colors.surfaceSubtle,
    borderColor: colors.borderLight,
    opacity: 0.6,
  },
  meds: { gap: 2 },
  medRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: {
    width: 10,
    height: 10,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.2)',
  },
  statusChip: {
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginTop: 2,
  },
});
