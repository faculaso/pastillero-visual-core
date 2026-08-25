import React from 'react';
import { View, Modal, Pressable, StyleSheet } from 'react-native';
import type { WeekDoseView } from '../../../../application';
import { DoseStatus } from '../../../../domain';
import { AccessibleText } from '../../../design-system/AccessibleText';
import { AccessibleButton } from '../../../design-system/AccessibleButton';
import { colors, radii, spacing, shadows } from '../../../design-system/tokens';

export interface WeekCellDetailModalProps {
  /** `null` = cerrado. Array vacío = abierto sobre un casillero sin dosis programadas. */
  readonly doses: readonly WeekDoseView[] | null;
  readonly label: string;
  readonly onClose: () => void;
  readonly onViewTreatment: (treatmentId: string) => void;
  readonly onAddTreatment: () => void;
}

function describeStatus(status: DoseStatus): { readonly label: string; readonly color: string } {
  switch (status) {
    case DoseStatus.TAKEN:
      return { label: 'Tomada', color: colors.success };
    case DoseStatus.MISSED:
      return { label: 'No tomada', color: colors.critical };
    case DoseStatus.SKIPPED:
      return { label: 'Omitida', color: colors.textSecondary };
    case DoseStatus.PENDING:
    default:
      return { label: 'Pendiente', color: colors.warning };
  }
}

/**
 * Solo lectura respecto de las tomas ya programadas a propósito: confirmar
 * una toma es una acción del Adulto Mayor (CU-02), no del Cuidador — acá se
 * ve el estado y se puede saltar a `AdherenceDashboard` del tratamiento,
 * nunca marcar nada desde esta pantalla. La ÚNICA acción de escritura que
 * vive acá es "Agregar tratamiento" cuando el casillero tocado está vacío —
 * ya no hay un botón "+" flotante separado; el pastillero (la grilla) es el
 * punto de entrada único para agregar, y siempre en el contexto de un
 * día/turno concreto.
 */
export function WeekCellDetailModal({
  doses,
  label,
  onClose,
  onViewTreatment,
  onAddTreatment,
}: WeekCellDetailModalProps): React.JSX.Element {
  const isEmpty = doses !== null && doses.length === 0;

  return (
    <Modal visible={doses !== null} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <AccessibleText variant="small" bold color={colors.primaryDark}>
            {label}
          </AccessibleText>

          {isEmpty ? (
            <AccessibleText variant="body" color={colors.textSecondary}>
              Sin dosis programadas en este turno.
            </AccessibleText>
          ) : (
            <View style={styles.list}>
              {(doses ?? []).map((dose) => {
                const status = describeStatus(dose.status);
                return (
                  <Pressable
                    key={dose.doseId}
                    onPress={() => onViewTreatment(dose.treatmentId)}
                    style={styles.row}
                    accessibilityRole="button"
                    accessibilityLabel={`Ver adherencia y stock de ${dose.medicationName}`}
                  >
                    <View style={[styles.dot, { backgroundColor: dose.visualProfile.color }]} />
                    <View style={styles.rowText}>
                      <AccessibleText variant="body" bold>
                        {dose.medicationName}
                      </AccessibleText>
                      <AccessibleText variant="small" color={status.color} bold>
                        {status.label}
                      </AccessibleText>
                    </View>
                    <AccessibleText variant="small" color={colors.primary} bold>
                      Ver →
                    </AccessibleText>
                  </Pressable>
                );
              })}
            </View>
          )}

          {isEmpty ? (
            <AccessibleButton label="Agregar tratamiento para este turno" onPress={onAddTreatment} />
          ) : null}
          <AccessibleButton label="Cerrar" variant="secondary" onPress={onClose} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.card,
  },
  list: { gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceSubtle,
  },
  rowText: { flex: 1, gap: 2 },
  dot: {
    width: 14,
    height: 14,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.2)',
  },
});
