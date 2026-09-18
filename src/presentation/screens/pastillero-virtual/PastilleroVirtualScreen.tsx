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
import { StockNoticeBanner } from './components/StockNoticeBanner';
import { DailyProgressBar } from './components/DailyProgressBar';
import { InstructionBadge } from './components/InstructionBadge';
import { CelebrationOverlay } from './components/CelebrationOverlay';
import { ConfirmDoseButton } from './components/ConfirmDoseButton';
import { TimeOfDayBackdrop } from './components/TimeOfDayBackdrop';

/**
 * 24 horas a propósito: es el formato de uso corriente en Argentina (turnos,
 * transporte, TV) y sobre todo elimina la ambigüedad de "12:00 a. m." —
 * mediodía y medianoche se dicen igual en el reloj de 12 y son el error más
 * caro posible en una app de medicación.
 */
function formatTime(date: Date): string {
  return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
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
  const { getPendingDoses, confirmDose, getDailyProgress, extendDoseHorizon } = useUseCases();
  const { signOut, switchRole } = useSession();
  // Se instancia una sola vez por montaje de pantalla (ver justificación en el hook).
  const confirmationFeedback = useMemo(() => new NativeConfirmationFeedback(), []);
  const useStore = usePastilleroVirtualStore({ getPendingDoses, confirmDose, getDailyProgress, confirmationFeedback });

  const status = useStore((s) => s.status);
  const doses = useStore((s) => s.doses);
  const error = useStore((s) => s.error);
  const stockNotice = useStore((s) => s.stockNotice);
  const dismissStockNotice = useStore((s) => s.dismissStockNotice);
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

  // Completar el horizonte NO bloquea la primera lectura: hace una consulta
  // por tratamiento activo y encadenarlo antes dejaba el pastillero vacío
  // en pantalla varios segundos, que es justo lo que no puede pasar acá.
  // Solo se recarga si creó tomas — lo normal es que no cree ninguna.
  useEffect(() => {
    void (async () => {
      const result = await extendDoseHorizon.execute({ patientId });
      if (result.ok && result.value.createdCount > 0) await loadPendingDoses(patientId);
    })();
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
  // Se captura al confirmar porque para cuando corre la animación la toma ya
  // salió de `doses` — sin esto, la confirmación mostraría un comprimido de
  // color genérico justo después de prometer "así se ve TU pastilla".
  const [confirmedDose, setConfirmedDose] = useState<{ color: string; name: string } | null>(null);
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

  // "Cambiar de rol" no cierra sesión: lleva al selector, que es también el
  // único lugar desde donde se activa el otro rol con el mismo correo.
  function handleAccountPress(): void {
    Alert.alert('Tu cuenta', '¿Qué querés hacer?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cambiar de rol', onPress: switchRole },
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
        <InviteCodeButton patientId={patientId} theme={theme} />
        <Pressable
          onPress={() => navigation.navigate('MiSemana')}
          accessibilityRole="button"
          accessibilityLabel="Ver mi semana"
          hitSlop={8}
          style={({ pressed }) => [
            styles.navButton,
            theme ? { backgroundColor: theme.chipBackground, borderColor: theme.chipBorder } : null,
            pressed && styles.navButtonPressed,
          ]}
        >
          <AccessibleText variant="small" bold color={theme?.accentText ?? colors.textSecondary}>
            Semana
          </AccessibleText>
        </Pressable>
        <Pressable
          onPress={handleAccountPress}
          accessibilityRole="button"
          accessibilityLabel="Tu cuenta: cambiar de rol o cerrar sesión"
          hitSlop={8}
          style={({ pressed }) => [
            styles.navButton,
            theme ? { backgroundColor: theme.chipBackground, borderColor: theme.chipBorder } : null,
            pressed && styles.navButtonPressed,
          ]}
        >
          <AccessibleText variant="small" bold color={theme?.accentText ?? colors.textSecondary}>
            Cuenta
          </AccessibleText>
        </Pressable>
      </Animated.View>

      {status === 'loading' || status === 'idle' ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : currentDose && theme ? (
        // La acción de confirmar vive FUERA del `ScrollView`, anclada al pie:
        // es el paso 4 de CU-02 y el botón más importante de la app, así que
        // nunca puede depender de que el usuario scrollee para encontrarlo
        // (con nombre largo + foto + instrucciones la tarjeta sola ya supera
        // el alto útil de la pantalla). El scroll queda solo para el
        // CONTENIDO — el qué —, y el pie sostiene el cómo-confirmar siempre
        // visible, igual que la tapa de un pastillero físico siempre al alcance.
        <>
          {/* Con el indicador de scroll VISIBLE a propósito: la tarjeta puede
              exceder el alto útil y, con el pie anclado, el corte cae contra
              un borde duro — sin la barra no queda ninguna señal de que hay
              más abajo (p. ej. "Escuchar indicaciones"). */}
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <Animated.View style={[styles.topHeader, headerEntrance]}>
              <View style={[styles.turnoChip, { backgroundColor: theme.chipBackground, borderColor: theme.chipBorder }]}>
                <AccessibleText variant="small" color={theme.accentText} bold>
                  {theme.label} · {formatTime(currentDose.scheduledAt)}
                </AccessibleText>
              </View>
              <AccessibleText variant="title" bold color={theme.accentText}>
                Toma tu medicación
              </AccessibleText>
            </Animated.View>

            {dailyProgress ? (
              <Animated.View style={progressEntrance}>
                <DailyProgressBar
                  totalScheduled={dailyProgress.totalScheduled}
                  totalTaken={dailyProgress.totalTaken}
                  labelColor={theme.accentText}
                  trackColor={theme.recessedSurface}
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
                theme={theme}
              />
            </Animated.View>
          </ScrollView>

          <View style={[styles.confirmFooter, { borderTopColor: theme.chipBorder }]}>
            {/* Convive con el botón en vez de taparlo: la toma que lo
                disparó ya quedó registrada, no hay nada que reintentar. */}
            {stockNotice ? (
              <StockNoticeBanner message={stockNotice} onDismiss={dismissStockNotice} />
            ) : null}

            {error ? (
              <ErrorBanner message={error} onDismiss={dismissError} />
            ) : (
              <ConfirmDoseButton
                loading={status === 'confirming'}
                disabled={status === 'confirming' || !selectedDose}
                onPress={() => {
                  if (!selectedDose) return;
                  setConfirmedDose({
                    color: selectedDose.visualProfile.color,
                    name: selectedDose.medicationName,
                  });
                  void confirmCurrentDose(patientId, selectedDose.doseId);
                }}
                staggerIndex={5}
              />
            )}
          </View>
        </>
      ) : (
        <View style={styles.centered}>
          <EmptyState dailyProgress={dailyProgress} />
        </View>
      )}

      <CelebrationOverlay
        trigger={celebrationTrigger}
        pillColor={confirmedDose?.color}
        medicationName={confirmedDose?.name}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  topBar: {
    // Los tres accesos reparten el ancho en vez de amontonarse a la derecha:
    // apretados contra el borde dejaban media pantalla vacía a la izquierda
    // y competían entre sí por un mismo rincón.
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  navButton: {
    flex: 1,
    minHeight: touchTarget.minHeight,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  navButtonPressed: {
    backgroundColor: 'rgba(15, 23, 42, 0.06)',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    justifyContent: 'center',
    gap: spacing.md,
  },
  topHeader: {
    gap: spacing.sm,
  },
  turnoChip: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  confirmFooter: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderTopWidth: 1,
  },
});
