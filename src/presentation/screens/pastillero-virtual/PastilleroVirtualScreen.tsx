import React, { useEffect, useMemo } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUseCases } from '../../providers/UseCasesProvider';
import { usePastilleroVirtualStore } from '../../hooks/usePastilleroVirtualStore';
import { NativeConfirmationFeedback } from '../../services/confirmation-feedback.service';
import { AccessibleButton } from '../../design-system/AccessibleButton';
import { colors, spacing } from '../../design-system/tokens';
import { CurrentDoseCard } from './components/CurrentDoseCard';
import { EmptyState } from './components/EmptyState';
import { ErrorBanner } from './components/ErrorBanner';

export interface PastilleroVirtualScreenProps {
  /** Viene de la sesión/auth del dispositivo — fuera del alcance de este módulo. */
  readonly patientId: string;
}

/**
 * CU-02 completo: abrir la pantalla dispara la carga de tomas pendientes
 * (paso 2-3); el botón "Confirmar Toma" ejecuta `ConfirmDoseUseCase` (paso
 * 4-6) y el feedback háptico se dispara solo tras éxito confirmado por el
 * dominio — nunca de forma optimista antes de la respuesta del use case,
 * para no confirmarle al usuario algo que después falló.
 */
export function PastilleroVirtualScreen({ patientId }: PastilleroVirtualScreenProps): React.JSX.Element {
  const { getPendingDoses, confirmDose } = useUseCases();
  // Se instancia una sola vez por montaje de pantalla (ver justificación en el hook).
  const confirmationFeedback = useMemo(() => new NativeConfirmationFeedback(), []);
  const useStore = usePastilleroVirtualStore({ getPendingDoses, confirmDose, confirmationFeedback });

  const status = useStore((s) => s.status);
  const doses = useStore((s) => s.doses);
  const error = useStore((s) => s.error);
  const loadPendingDoses = useStore((s) => s.loadPendingDoses);
  const confirmCurrentDose = useStore((s) => s.confirmCurrentDose);
  const dismissError = useStore((s) => s.dismissError);

  useEffect(() => {
    loadPendingDoses(patientId);
    // Se recarga solo si cambia el paciente (p. ej. perfil compartido en un mismo dispositivo).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  const currentDose = doses[0] ?? null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {status === 'loading' || status === 'idle' ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : currentDose ? (
          <>
            <CurrentDoseCard dose={currentDose} />
            <View style={styles.confirmSection}>
              {error ? (
                <ErrorBanner message={error} onDismiss={dismissError} />
              ) : (
                <AccessibleButton
                  label="Confirmar Toma"
                  variant="success"
                  fullHeight
                  loading={status === 'confirming'}
                  disabled={status === 'confirming'}
                  accessibilityHint="Marca esta toma como completada"
                  onPress={() => confirmCurrentDose(patientId)}
                />
              )}
            </View>
          </>
        ) : (
          <EmptyState />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: 'center',
    gap: spacing.xl,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  confirmSection: {
    gap: spacing.md,
  },
});
