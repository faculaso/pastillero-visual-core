import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, ScrollView, Alert, Pressable } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AdultoMayorStackParamList } from '../../navigation/types';
import { useUseCases } from '../../providers/UseCasesProvider';
import { useSession } from '../../providers/SessionContext';
import { usePastilleroVirtualStore } from '../../hooks/usePastilleroVirtualStore';
import { useStaggeredEntrance } from '../../hooks/useStaggeredEntrance';
import { NativeConfirmationFeedback } from '../../services/confirmation-feedback.service';
import { AccessibleText } from '../../design-system/AccessibleText';
import { colors, spacing, radii, touchTarget } from '../../design-system/tokens';
import { getTimeOfDayTheme } from '../../utils/time-of-day-theme';
import { DoseCarousel } from './components/DoseCarousel';
import { InviteCodeButton } from './components/InviteCodeButton';
import { EmptyState } from './components/EmptyState';
import { ErrorBanner } from './components/ErrorBanner';
import { DailyProgressBar } from './components/DailyProgressBar';
import { InstructionBadge } from './components/InstructionBadge';
import { CelebrationOverlay } from './components/CelebrationOverlay';
import { ConfirmDoseButton } from './components/ConfirmDoseButton';
import { TimeOfDayBackdrop } from './components/TimeOfDayBackdrop';

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
  // Dos (o más) medicamentos pueden compartir turno exacto — se agrupan acá
  // y se navegan deslizando en `DoseCarousel`, en vez de forzar que
  // `ConfirmDoseUseCase` (que ya soporta confirmar una sin afectar la otra)
  // solo pueda alcanzarse una a la vez desde esta pantalla.
  const currentGroup = currentDose
    ? doses.filter((d) => d.scheduledAt.getTime() === currentDose.scheduledAt.getTime())
    : [];
  const [groupIndex, setGroupIndex] = useState(0);
  useEffect(() => {
    if (groupIndex >= currentGroup.length) setGroupIndex(0);
    // Solo debe recortar el índice cuando el GRUPO se achica (p. ej. tras
    // confirmar la toma que se estaba viendo) — no en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentGroup.length]);
  const selectedDose = currentGroup[groupIndex] ?? currentGroup[0] ?? null;
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

  // Hooks llamados incondicionalmente en el nivel superior — el render de
  // más abajo los usa dentro de un ternario, pero eso no afecta el orden en
  // que React los ve (a diferencia de un `return` condicional temprano).
  const topBarEntrance = useStaggeredEntrance(0);
  const headerEntrance = useStaggeredEntrance(1);
  const progressEntrance = useStaggeredEntrance(2);
  const instructionEntrance = useStaggeredEntrance(3);
  const pillboxEntrance = useStaggeredEntrance(4);

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
      {theme ? <TimeOfDayBackdrop theme={theme} /> : null}
      <Animated.View style={[styles.topBar, topBarEntrance]}>
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
      </Animated.View>

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
          <Animated.View style={[styles.topHeader, headerEntrance]}>
            <View style={styles.turnoChip}>
              <AccessibleText variant="small" color={theme.accentText} bold>
                {theme.emoji} Turno {theme.label} • {formatTime(currentDose.scheduledAt)}
              </AccessibleText>
            </View>
            <AccessibleText variant="title" bold color={theme.accentText}>
              Toma tu medicación
            </AccessibleText>
          </Animated.View>

          {dailyProgress ? (
            <Animated.View style={[styles.progressCard, progressEntrance]}>
              <DailyProgressBar
                totalScheduled={dailyProgress.totalScheduled}
                totalTaken={dailyProgress.totalTaken}
                labelColor={theme.accentText}
              />
            </Animated.View>
          ) : null}

          <Animated.View style={instructionEntrance}>
            <InstructionBadge theme={theme} />
          </Animated.View>

          <Animated.View style={pillboxEntrance}>
            <DoseCarousel
              doses={currentGroup}
              celebrationTrigger={celebrationTrigger}
              index={groupIndex}
              onIndexChange={setGroupIndex}
            />
          </Animated.View>
          <View style={styles.confirmSection}>
            {error ? (
              <ErrorBanner message={error} onDismiss={dismissError} />
            ) : (
              <ConfirmDoseButton
                loading={status === 'confirming'}
                disabled={status === 'confirming' || !selectedDose}
                onPress={() => selectedDose && confirmCurrentDose(patientId, selectedDose.doseId)}
                staggerIndex={5}
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
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.sm,
  },
  progressCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: radii.xl,
    padding: spacing.md,
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
    gap: spacing.sm,
  },
  turnoChip: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
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
