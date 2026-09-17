import React, { useCallback, useEffect, useState } from 'react';
import { View, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MonitorAdherenceOutput } from '../../../application';
import { TreatmentStatus } from '../../../domain';
import { useUseCases } from '../../providers/UseCasesProvider';
import { useSession } from '../../providers/SessionContext';
import type { CuidadorStackParamList } from '../../navigation/types';
import { AccessibleText } from '../../design-system/AccessibleText';
import { AccessibleButton } from '../../design-system/AccessibleButton';
import { colors, spacing } from '../../design-system/tokens';
import { AdherenceMetricsCard } from './components/AdherenceMetricsCard';
import { StockAlertBadge } from './components/StockAlertBadge';
import { UpdateStockForm } from './components/UpdateStockForm';
import { TreatmentStatusActions } from './components/TreatmentStatusActions';

type Props = NativeStackScreenProps<CuidadorStackParamList, 'AdherenceDashboard'>;

type ScreenStatus = 'loading' | 'ready' | 'error';

/**
 * CU-03 completo. Separo "cargar métricas" (`MonitorAdherenceUseCase`) de
 * "actualizar stock" (`UpdateStockUseCase`) tal como quedaron los use
 * cases: dos operaciones distintas, la segunda dispara un refetch de la
 * primera para reflejar el nuevo nivel de alerta post-recarga (paso 5 del
 * CU cierra el ciclo abierto en el paso 4).
 */
export function AdherenceDashboardScreen({ route, navigation }: Props): React.JSX.Element {
  const { treatmentId } = route.params;
  const { monitorAdherence, updateStock, changeTreatmentStatus } = useUseCases();
  const { session } = useSession();

  const [status, setStatus] = useState<ScreenStatus>('loading');
  const [data, setData] = useState<MonitorAdherenceOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatingStock, setUpdatingStock] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);

  const loadMetrics = useCallback(async () => {
    if (!session) return;
    setStatus('loading');
    const result = await monitorAdherence.execute({
      treatmentId,
      requestingCaregiverId: session.caregiverId,
    });
    if (!result.ok) {
      setStatus('error');
      setError('No pudimos cargar las métricas de este tratamiento.');
      return;
    }
    setData(result.value);
    setStatus('ready');
  }, [monitorAdherence, session, treatmentId]);

  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  async function handleUpdateStock(newQuantity: number): Promise<void> {
    if (!session) return;
    setUpdatingStock(true);
    const result = await updateStock.execute({
      treatmentId,
      requestingCaregiverId: session.caregiverId,
      newQuantity,
    });
    setUpdatingStock(false);
    if (!result.ok) {
      setError('No pudimos actualizar el stock. Intentá de nuevo.');
      return;
    }
    // Refetch en vez de mergear localmente: `adherencePercentage` y
    // `estimatedDaysRemaining` dependen de más que el campo que acabamos
    // de cambiar — más simple y correcto pedirle al dominio que recalcule.
    await loadMetrics();
  }

  async function handleChangeStatus(newStatus: TreatmentStatus): Promise<void> {
    if (!session) return;
    setChangingStatus(true);
    setError(null);
    const result = await changeTreatmentStatus.execute({
      treatmentId,
      requestingCaregiverId: session.caregiverId,
      newStatus,
    });
    setChangingStatus(false);

    if (!result.ok) {
      setError('No pudimos cambiar el estado del tratamiento. Intentá de nuevo.');
      return;
    }

    // Una alarma que no se pudo apagar es lo único peor que no haber hecho
    // nada: el tratamiento figura de baja y el teléfono igual suena. Se
    // avisa, sin revertir — el estado ya quedó guardado.
    if (result.value.alarmWarnings.length > 0) {
      setError('El tratamiento cambió de estado, pero quedaron alarmas sin apagar. Reiniciá la app para que se actualicen.');
    }

    if (newStatus === TreatmentStatus.CANCELLED) {
      // Volver al pastillero ES el comprobante: el medicamento ya no está
      // en la grilla. Quedarse en la pantalla de un tratamiento muerto, en
      // cambio, no ofrece nada que hacer.
      navigation.goBack();
      return;
    }

    await loadMetrics();
  }

  if (status === 'loading') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (status === 'error' || !data) {
    return (
      <View style={styles.centered}>
        <AccessibleText color={colors.critical} bold style={styles.centerText}>
          {error ?? 'No pudimos cargar este tratamiento.'}
        </AccessibleText>
        {/* Sin este botón el texto pedía reintentar sin ofrecer cómo: había
            que salir de la pantalla y volver a entrar. */}
        <AccessibleButton label="Reintentar" variant="secondary" onPress={() => void loadMetrics()} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* El nombre del medicamento ES el título: se llega acá desde una
          lista donde dos tratamientos pueden mostrar el mismo nombre
          comercial, y abajo hay un formulario que le cambia el stock. */}
      <AccessibleText variant="title" bold>
        {data.medicationName}
      </AccessibleText>
      <AccessibleText variant="small" color={colors.textSecondary}>
        Adherencia y stock de los últimos 30 días
      </AccessibleText>

      <StockAlertBadge level={data.metrics.stockAlertLevel} />
      <AdherenceMetricsCard metrics={data.metrics} />

      {error ? (
        <AccessibleText color={colors.critical} bold>
          {error}
        </AccessibleText>
      ) : null}

      {/* Reponer stock solo tiene sentido mientras el tratamiento siga en
          curso: de uno dado de baja no se compra más. */}
      {data.status === TreatmentStatus.ACTIVE || data.status === TreatmentStatus.PAUSED ? (
        <UpdateStockForm
          loading={updatingStock}
          currentQuantity={data.stock.currentQuantity}
          unit={data.stock.unit}
          onSubmit={handleUpdateStock}
        />
      ) : null}

      <TreatmentStatusActions
        status={data.status}
        medicationName={data.medicationName}
        busy={changingStatus}
        onChange={(newStatus) => void handleChangeStatus(newStatus)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  centerText: { textAlign: 'center' },
});
