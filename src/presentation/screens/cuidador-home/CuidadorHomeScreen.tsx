import React, { useCallback, useState } from 'react';
import { View, ScrollView, ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CuidadorStackParamList } from '../../navigation/types';
import type { WeekDoseView, GetWeeklyScheduleOutput } from '../../../application';
import { useUseCases } from '../../providers/UseCasesProvider';
import { useSession } from '../../providers/SessionContext';
import { AccessibleText } from '../../design-system/AccessibleText';
import { colors, radii, spacing, shadows } from '../../design-system/tokens';
import { groupDosesByWeek } from '../../utils/group-doses-by-week';
import { LinkPatientPrompt } from '../register-treatment/components/LinkPatientPrompt';
import { WeekGrid, type Turno } from './components/WeekGrid';
import { WeekCellDetailModal } from './components/WeekCellDetailModal';
import { EmptyWeek } from './components/EmptyWeek';

type Props = NativeStackScreenProps<CuidadorStackParamList, 'CuidadorHome'>;

type ScreenStatus = 'loading' | 'ready' | 'error';

interface CellSelection {
  readonly doses: readonly WeekDoseView[];
  readonly label: string;
  readonly turno: Turno;
}

/** Hora representativa de cada turno, para sugerir un horario al agregar un tratamiento desde un casillero. */
const SUGGESTED_HOUR: Record<Turno, number> = { morning: 8, afternoon: 14, night: 21 };

/**
 * Nueva ruta raíz de `CuidadorStack` — reemplaza el bug reportado
 * ("Registrar tratamiento" era la pantalla de arranque, sin forma de volver
 * ni de ver lo ya asignado). El pastillero semanal (la grilla) es el único
 * punto de entrada para agregar un tratamiento — no hay un botón "+"
 * flotante: se agrega tocando el casillero del día/turno correspondiente,
 * así el pastillero queda como el indicador central que maneja todo.
 */
export function CuidadorHomeScreen({ navigation }: Props): React.JSX.Element {
  const { getWeeklySchedule } = useUseCases();
  const { session } = useSession();

  const [status, setStatus] = useState<ScreenStatus>('loading');
  const [data, setData] = useState<GetWeeklyScheduleOutput | null>(null);
  const [selection, setSelection] = useState<CellSelection | null>(null);

  const hasLinkedPatient = Boolean(session?.patientId);

  const load = useCallback(async () => {
    if (!session || !hasLinkedPatient) return;
    setStatus('loading');
    const result = await getWeeklySchedule.execute({ patientId: session.patientId });
    if (!result.ok) {
      setStatus('error');
      return;
    }
    setData(result.value);
    setStatus('ready');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.patientId, hasLinkedPatient]);

  // Se recarga cada vez que la pantalla vuelve a tener foco (p. ej. al volver
  // de registrar un tratamiento nuevo) — no solo al montar una vez.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (session && session.role === 'CUIDADOR' && !hasLinkedPatient) {
    return <LinkPatientPrompt />;
  }

  const buckets = data ? groupDosesByWeek(data.doses, data.weekStart) : [];

  return (
    <View style={styles.screen}>
      {status === 'loading' && !data ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : status === 'error' ? (
        <View style={styles.centered}>
          <AccessibleText color={colors.critical} bold style={styles.centerText}>
            No pudimos cargar tu semana. Volvé a intentar.
          </AccessibleText>
        </View>
      ) : data ? (
        <ScrollView contentContainerStyle={styles.content}>
          {data.doses.length === 0 ? <EmptyWeek /> : null}

          {data.treatmentsNeedingAttention.length > 0 ? (
            <View style={styles.attentionBanner}>
              <AccessibleText variant="small" bold color={colors.critical}>
                Necesitan reponer stock
              </AccessibleText>
              {data.treatmentsNeedingAttention.map((t) => (
                <Pressable
                  key={t.treatmentId}
                  onPress={() => navigation.navigate('AdherenceDashboard', { treatmentId: t.treatmentId })}
                  accessibilityRole="button"
                  accessibilityLabel={`Ver adherencia y stock de ${t.medicationName}`}
                >
                  <AccessibleText variant="small" color={colors.critical}>
                    • {t.medicationName} →
                  </AccessibleText>
                </Pressable>
              ))}
            </View>
          ) : null}

          {data.doses.length > 0 ? (
            <View style={styles.statCard}>
              <AccessibleText variant="small" color={colors.textSecondary}>
                Adherencia de esta semana
              </AccessibleText>
              <AccessibleText variant="title" bold color={colors.success}>
                {data.adherencePercentage}%
              </AccessibleText>
            </View>
          ) : null}

          <WeekGrid buckets={buckets} onCellPress={(doses, label, turno) => setSelection({ doses, label, turno })} />
        </ScrollView>
      ) : null}

      <WeekCellDetailModal
        doses={selection?.doses ?? null}
        label={selection?.label ?? ''}
        onClose={() => setSelection(null)}
        onViewTreatment={(treatmentId) => {
          setSelection(null);
          navigation.navigate('AdherenceDashboard', { treatmentId });
        }}
        onAddTreatment={() => {
          const turno = selection?.turno ?? 'morning';
          setSelection(null);
          navigation.navigate('RegisterTreatment', { suggestedHour: SUGGESTED_HOUR[turno] });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  centerText: { textAlign: 'center' },
  attentionBanner: {
    backgroundColor: colors.criticalBackground,
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.xs,
  },
  statCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.lg,
    gap: spacing.xs,
    ...shadows.card,
  },
});
