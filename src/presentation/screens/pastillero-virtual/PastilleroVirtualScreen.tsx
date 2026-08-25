import React, { useEffect, useMemo } from 'react';
import { View, StyleSheet, ActivityIndicator, ScrollView, Alert, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AdultoMayorStackParamList } from '../../navigation/types';
import { useUseCases } from '../../providers/UseCasesProvider';
import { useSession } from '../../providers/SessionContext';
import { usePastilleroVirtualStore } from '../../hooks/usePastilleroVirtualStore';
import { NativeConfirmationFeedback } from '../../services/confirmation-feedback.service';
import { AccessibleButton } from '../../design-system/AccessibleButton';
import { AccessibleText } from '../../design-system/AccessibleText';
import { colors, spacing, radii, touchTarget } from '../../design-system/tokens';
import { getTimeOfDayTheme } from '../../utils/time-of-day-theme';
import { CurrentDoseCard } from './components/CurrentDoseCard';
import { PillboxCompartment } from './components/PillboxCompartment';
import { InviteCodeButton } from './components/InviteCodeButton';
import { EmptyState } from './components/EmptyState';
import { ErrorBanner } from './components/ErrorBanner';
import { DailyProgressBar } from './components/DailyProgressBar';
import { InstructionBadge } from './components/InstructionBadge';
import { CelebrationOverlay } from './components/CelebrationOverlay';

function formatTime(date: Date): string {
  return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

export interface PastilleroVirtualScreenProps {
  /** Viene de la sesión/auth del dispositivo — fuera del alcance de este módulo. */
  readonly patientId: string;
  readonly navigation: NativeStackNavigationProp<AdultoMayorStackParamList, 'PastilleroVirtual'>;
}

/**
 * CU-02 completo: abrir la pantalla dispara la carga de tomas pendientes
 * (paso 2-3); el botón "Confirmar Toma" ejecuta `ConfirmDoseUseCase` (paso
 * 4-6) y el feedback háptico se dispara solo tras éxito confirmado por el
 * dominio — nunca de forma optimista antes de la respuesta del use case,
 * para no confirmarle al usuario algo que después falló.
 *
 * `DailyProgressBar` y `CelebrationOverlay` son puramente aditivos sobre
 * ese flujo: leen `dailyProgress`/`celebrationTrigger` del store, que ya
 * se actualizan solos tras cargar/confirmar — esta pantalla no orquesta
 * nada nuevo para ellos, solo los renderiza.
 */
export function PastilleroVirtualScreen({ patientId, navigation }: PastilleroVirtualScreenProps): React.JSX.Element {
  const { getPendingDoses, confirmDose, getDailyProgress } = useUseCases();
  const { signOut } = useSession();
  // Se instancia una sola vez por montaje de pantalla (ver justificación en el hook).
  const confirmationFeedback = useMemo(() => new NativeConfirmationFeedback(), []);
  const useStore = usePastilleroVirtualStore({ getPendingDoses, confirmDose, getDailyProgress, confirmationFeedback });

  const status = useStore((s) => s.status);
  const doses = useStore((s) => s.doses);
  const error = useStore((s) => s.error);
  const dailyProgress = useStore((s) => s.dailyProgress);
  const celebrationTrigger = useStore((s) => s.celebrationTrigger);
  const loadPendingDoses = useStore((s) => s.loadPendingDoses);
  const confirmCurrentDose = useStore((s) => s.confirmCurrentDose);
  const dismissError = useStore((s) => s.dismissError);

  useEffect(() => {
    loadPendingDoses(patientId);
    // Se recarga solo si cambia el paciente (p. ej. perfil compartido en un mismo dispositivo).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  const currentDose = doses[0] ?? null;
  // El tinte de fondo por turno (mañana/tarde/noche) vive a nivel de
  // PANTALLA, no en la tarjeta de la toma — misma estructura que el mockup
  // de referencia: la tarjeta blanca necesita contraste neutro constante
  // para mostrar bien el color/forma real del comprimido.
  const theme = currentDose ? getTimeOfDayTheme(currentDose.scheduledAt) : null;
  // `SafeAreaView` (el componente) confirmado NO aplica el padding superior en
  // este build (Fabric/New Architecture) aunque `useSafeAreaInsets()` calcule
  // el valor correcto — el contenido quedaba dibujado debajo de la status bar
  // en un dispositivo Android 16 real. Aplicar el inset a mano evita depender
  // de esa pieza rota del componente.
  const insets = useSafeAreaInsets();

  function handleSignOutPress(): void {
    Alert.alert('Cerrar sesión', '¿Querés salir de tu cuenta?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cerrar sesión', style: 'destructive', onPress: () => void signOut() },
    ]);
  }

  return (
    <View
      style={[
        styles.safeArea,
        { paddingTop: insets.top, paddingBottom: insets.bottom, backgroundColor: theme?.background ?? colors.background },
      ]}
    >
      <View style={styles.topBar}>
        {dailyProgress ? (
          <View style={styles.progressSlot}>
            <DailyProgressBar
              totalScheduled={dailyProgress.totalScheduled}
              totalTaken={dailyProgress.totalTaken}
              labelColor={theme?.accentText}
            />
          </View>
        ) : (
          <View style={styles.progressSlot} />
        )}
        <InviteCodeButton patientId={patientId} accentColor={theme?.accentText} />
        <Pressable
          onPress={() => navigation.navigate('MiSemana')}
          accessibilityRole="button"
          accessibilityLabel="Ver mi semana"
          hitSlop={8}
          style={({ pressed }) => [styles.signOutButton, pressed && styles.signOutButtonPressed]}
        >
          <AccessibleText variant="small" bold color={theme?.accentText ?? colors.textSecondary}>
            Semana
          </AccessibleText>
        </Pressable>
        <Pressable
          onPress={handleSignOutPress}
          accessibilityRole="button"
          accessibilityLabel="Cerrar sesión"
          hitSlop={8}
          style={({ pressed }) => [styles.signOutButton, pressed && styles.signOutButtonPressed]}
        >
          <AccessibleText variant="small" bold color={theme?.accentText ?? colors.textSecondary}>
            Salir
          </AccessibleText>
        </Pressable>
      </View>

      {status === 'loading' || status === 'idle' ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : currentDose && theme ? (
        // `ScrollView` (no un `View` centrado a secas): la tarjeta de la toma +
        // el botón de confirmar pueden ser más altos que la pantalla (nombre
        // largo, foto, instrucciones) — sin scroll, `justifyContent: 'center'`
        // desborda el contenido simétricamente para los DOS lados, cortando
        // "Confirmar Toma" (el botón más importante de la pantalla) contra el
        // borde inferior. Confirmado en un dispositivo real con poca altura útil.
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.topHeader}>
            <AccessibleText variant="small" color={theme.accentText} bold>
              {theme.emoji} Turno {theme.label} • {formatTime(currentDose.scheduledAt)}
            </AccessibleText>
            <AccessibleText variant="title" bold color={theme.accentText}>
              Toma tu medicación
            </AccessibleText>
          </View>

          <InstructionBadge theme={theme} />

          <PillboxCompartment doseId={currentDose.doseId} celebrationTrigger={celebrationTrigger}>
            <CurrentDoseCard dose={currentDose} />
          </PillboxCompartment>
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
        </ScrollView>
      ) : (
        <View style={styles.centered}>
          <EmptyState dailyProgress={dailyProgress} />
        </View>
      )}

      <CelebrationOverlay trigger={celebrationTrigger} />
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.sm,
  },
  progressSlot: {
    flex: 1,
  },
  signOutButton: {
    minHeight: touchTarget.minHeight,
    minWidth: 72,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  signOutButtonPressed: {
    backgroundColor: 'rgba(15, 23, 42, 0.06)',
  },
  scrollContent: {
    flexGrow: 1,
    padding: spacing.lg,
    justifyContent: 'center',
    gap: spacing.lg,
  },
  topHeader: {
    gap: spacing.xs,
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
