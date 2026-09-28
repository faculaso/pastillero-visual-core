import React, { useEffect, useState } from 'react';
import { View, ScrollView, ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AdultoMayorStackParamList } from '../../navigation/types';
import type { GetWeeklyScheduleOutput } from '../../../application';
import { useUseCases } from '../../providers/UseCasesProvider';
import { useStaggeredEntrance } from '../../hooks/useStaggeredEntrance';
import { AccessibleText } from '../../design-system/AccessibleText';
import { colors, radii, spacing, touchTarget, shadows } from '../../design-system/tokens';
import { groupDosesByWeek } from '../../utils/group-doses-by-week';
import { DaySection } from './components/DaySection';
import { WeekBackdrop } from './components/WeekBackdrop';

export interface MiSemanaScreenProps {
  readonly patientId: string;
  readonly navigation: NativeStackNavigationProp<AdultoMayorStackParamList, 'MiSemana'>;
}

type ScreenStatus = 'loading' | 'ready' | 'error';

function isSameDay(a: Date, b: Date): boolean {
  return a.toDateString() === b.toDateString();
}

/**
 * Versión accesible del pastillero semanal para el Adulto Mayor: lista
 * vertical de 7 días (no la grilla densa del Cuidador) — filas de turno de
 * al menos 72px, un solo foco por vez. Solo lectura salvo una excepción: una
 * toma pendiente de HOY es tocable y te manda de vuelta al pastillero
 * principal (`PastilleroVirtual`), que ya tiene el flujo real de confirmar
 * — acá nunca se duplica esa acción.
 */
export function MiSemanaScreen({ patientId, navigation }: MiSemanaScreenProps): React.JSX.Element {
  const { getWeeklySchedule } = useUseCases();
  const insets = useSafeAreaInsets();

  const [status, setStatus] = useState<ScreenStatus>('loading');
  const [data, setData] = useState<GetWeeklyScheduleOutput | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    void getWeeklySchedule.execute({ patientId }).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setStatus('error');
        return;
      }
      setData(result.value);
      setStatus('ready');
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  const today = new Date();
  const buckets = data ? groupDosesByWeek(data.doses, data.weekStart) : [];
  const topBarEntrance = useStaggeredEntrance(0);

  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <WeekBackdrop />
      <Animated.View style={[styles.topBar, topBarEntrance]}>
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Volver"
          hitSlop={8}
          style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
        >
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
            <Path d="M15 18L9 12L15 6" stroke={colors.primary} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
        <AccessibleText variant="title" bold>
          Mi semana
        </AccessibleText>
      </Animated.View>

      {status === 'loading' ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : status === 'error' ? (
        <View style={styles.centered}>
          <AccessibleText color={colors.critical} bold style={styles.centerText}>
            No pudimos cargar tu semana. Volvé a intentar.
          </AccessibleText>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {buckets.map((bucket) => (
            <DaySection
              key={bucket.dayIndex}
              bucket={bucket}
              isToday={isSameDay(bucket.date, today)}
              onPressTodayPending={() => navigation.navigate('PastilleroVirtual')}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  backButton: {
    // Sin sombra/elevation a propósito: combinada con `borderRadius` +
    // fondo translúcido, `elevation` de Android generó un artefacto
    // fantasma real en `progressCard` (ver `PastilleroVirtualScreen`) —
    // mismo riesgo acá, se evita de entrada.
    width: touchTarget.minWidth,
    height: touchTarget.minHeight,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    ...shadows.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonPressed: {
    backgroundColor: colors.primarySoft,
  },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  centerText: { textAlign: 'center' },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
});
