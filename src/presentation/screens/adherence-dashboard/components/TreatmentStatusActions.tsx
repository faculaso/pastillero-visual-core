import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { TreatmentStatus } from '../../../../domain';
import { AccessibleText } from '../../../design-system/AccessibleText';
import { AccessibleButton } from '../../../design-system/AccessibleButton';
import { AppDialog } from '../../../design-system/AppDialog';
import { colors, radii, spacing } from '../../../design-system/tokens';

export interface TreatmentStatusActionsProps {
  readonly status: TreatmentStatus;
  /** Se nombra en la confirmación: dar de baja el remedio equivocado no tiene vuelta atrás. */
  readonly medicationName: string;
  readonly busy: boolean;
  readonly onChange: (newStatus: TreatmentStatus) => void;
}

/**
 * Qué dice el cartel de estado. El texto explica la CONSECUENCIA, no
 * repite el nombre del estado: "Pausado" solo no le dice a nadie que el
 * teléfono dejó de sonar, que es exactamente lo que el Cuidador necesita
 * saber para quedarse tranquilo (o para alarmarse).
 */
const ESTADO: Record<TreatmentStatus, { label: string; detail: string; fg: string; bg: string; border: string } | null> = {
  [TreatmentStatus.ACTIVE]: null, // sin cartel: activo es lo normal, no una novedad
  [TreatmentStatus.PAUSED]: {
    label: 'En pausa',
    detail: 'No suenan las alarmas y no aparece en el pastillero. El historial se conserva.',
    fg: colors.warning,
    bg: colors.warningBackground,
    border: '#FED7AA',
  },
  [TreatmentStatus.CANCELLED]: {
    label: 'Dado de baja',
    detail: 'Este tratamiento terminó. No suena ni aparece en el pastillero.',
    fg: colors.critical,
    bg: colors.criticalBackground,
    border: '#FECACA',
  },
  [TreatmentStatus.COMPLETED]: {
    label: 'Terminado',
    detail: 'Se cumplió el tiempo indicado. No suena ni aparece en el pastillero.',
    fg: colors.textSecondary,
    bg: colors.surfaceSubtle,
    border: colors.borderLight,
  },
};

/**
 * Pausar, reanudar y dar de baja, desde la pantalla del tratamiento.
 *
 * Hasta acá el Cuidador no tenía NINGUNA forma de apagar un remedio que el
 * médico suspendió: seguía sonando para siempre. Lo único parecido era
 * borrarlo, que además se lleva puesto el historial de adherencia.
 *
 * Dar de baja pide confirmación porque el dominio no deja volver atrás
 * (`VALID_TREATMENT_TRANSITIONS`: desde CANCELLED no sale nada). Pausar no
 * la pide: es reversible de un toque, y pedir confirmación para algo
 * reversible solo entrena a la gente a apretar "Sí" sin leer, que es
 * justamente lo que no queremos que pase con la baja.
 */
export function TreatmentStatusActions({
  status,
  medicationName,
  busy,
  onChange,
}: TreatmentStatusActionsProps): React.JSX.Element {
  const cartel = ESTADO[status];
  const puedePausar = status === TreatmentStatus.ACTIVE;
  const puedeReanudar = status === TreatmentStatus.PAUSED;
  const puedeDarDeBaja = status === TreatmentStatus.ACTIVE || status === TreatmentStatus.PAUSED;

  const [bajaAbierta, setBajaAbierta] = useState(false);

  return (
    <View style={styles.card}>
      {cartel ? (
        // El estado nunca se comunica solo por color: el rótulo lo dice con
        // todas las letras y el detalle explica qué implica.
        <View style={[styles.cartel, { backgroundColor: cartel.bg, borderColor: cartel.border }]}>
          <AccessibleText variant="small" bold color={cartel.fg}>
            {cartel.label}
          </AccessibleText>
          <AccessibleText variant="small" color={cartel.fg}>
            {cartel.detail}
          </AccessibleText>
        </View>
      ) : null}

      {puedePausar ? (
        <AccessibleButton
          label="Pausar tratamiento"
          variant="secondary"
          disabled={busy}
          onPress={() => onChange(TreatmentStatus.PAUSED)}
          accessibilityHint="Deja de sonar y de aparecer en el pastillero. Se puede reanudar cuando quieras."
        />
      ) : null}

      {puedeReanudar ? (
        <AccessibleButton
          label="Reanudar tratamiento"
          disabled={busy}
          onPress={() => onChange(TreatmentStatus.ACTIVE)}
          accessibilityHint="Vuelve a sonar y a aparecer en el pastillero desde la próxima toma."
        />
      ) : null}

      {puedeDarDeBaja ? (
        <AccessibleButton
          label="Dar de baja"
          variant="secondary"
          disabled={busy}
          onPress={() => setBajaAbierta(true)}
          accessibilityHint="El tratamiento termina definitivamente. Pide confirmación."
        />
      ) : null}

      {!puedePausar && !puedeReanudar && !puedeDarDeBaja ? (
        <AccessibleText variant="small" color={colors.textSecondary}>
          Para volver a usar este medicamento hay que cargarlo como un tratamiento nuevo.
        </AccessibleText>
      ) : null}

      <AppDialog
        visible={bajaAbierta}
        title="Dar de baja el tratamiento"
        message={`${medicationName} deja de sonar y desaparece del pastillero. Esto no se puede deshacer: para volver a usarlo habría que cargarlo de nuevo.`}
        onDismiss={() => setBajaAbierta(false)}
        actions={[
          {
            label: 'Dar de baja',
            variant: 'danger',
            onPress: () => {
              setBajaAbierta(false);
              onChange(TreatmentStatus.CANCELLED);
            },
          },
          { label: 'Cancelar', variant: 'secondary', onPress: () => setBajaAbierta(false) },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  cartel: {
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.xs,
  },
});
