import React, { useCallback, useEffect, useState } from 'react';
import { View, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AdherenceMetrics } from '../../../domain';
import { useUseCases } from '../../providers/UseCasesProvider';
import { useSession } from '../../providers/SessionContext';
import type { CuidadorStackParamList } from '../../navigation/types';
import { AccessibleText } from '../../design-system/AccessibleText';
import { colors, spacing } from '../../design-system/tokens';
import { AdherenceMetricsCard } from './components/AdherenceMetricsCard';
import { StockAlertBadge } from './components/StockAlertBadge';
import { UpdateStockForm } from './components/UpdateStockForm';

type Props = NativeStackScreenProps<CuidadorStackParamList, 'AdherenceDashboard'>;

type ScreenStatus = 'loading' | 'ready' | 'error';

/**
 * CU-03 completo. Separo "cargar métricas" (`MonitorAdherenceUseCase`) de
 * "actualizar stock" (`UpdateStockUseCase`) tal como quedaron los use
 * cases: dos operaciones distintas, la segunda dispara un refetch de la
 * primera para reflejar el nuevo nivel de alerta post-recarga (paso 5 del
 * CU cierra el ciclo abierto en el paso 4).
 */
export function AdherenceDashboardScreen({ route }: Props): React.JSX.Element {
  const { treatmentId } = route.params;
  const { monitorAdherence, updateStock } = useUseCases();
  const { session } = useSession();

  const [status, setStatus] = useState<ScreenStatus>('loading');
  const [metrics, setMetrics] = useState<AdherenceMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatingStock, setUpdatingStock] = useState(false);

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
    setMetrics(result.value.metrics);
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

  if (status === 'loading') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (status === 'error' || !metrics) {
    return (
      <View style={styles.centered}>
        <AccessibleText color={colors.critical} bold style={styles.centerText}>
          {error ?? 'No pudimos cargar este tratamiento.'}
        </AccessibleText>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <AccessibleText variant="title" bold>
        Adherencia y stock
      </AccessibleText>

      <StockAlertBadge level={metrics.stockAlertLevel} />
      <AdherenceMetricsCard metrics={metrics} />

      {error ? (
        <AccessibleText color={colors.critical} bold>
          {error}
        </AccessibleText>
      ) : null}

      <UpdateStockForm
        loading={updatingStock}
        onSubmit={handleUpdateStock}
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
