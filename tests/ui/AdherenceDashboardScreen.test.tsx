import React from 'react';
import { render, screen, waitFor, userEvent } from '@testing-library/react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AdherenceDashboardScreen } from '../../src/presentation/screens/adherence-dashboard/AdherenceDashboardScreen';
import type { CuidadorStackParamList } from '../../src/presentation/navigation/types';
import { Ok, Err, DomainErrors, StockAlertLevel } from '../../src/domain';
import { withProviders } from './test-utils';
import type { AdherenceMetrics } from '../../src/domain';

type Props = NativeStackScreenProps<CuidadorStackParamList, 'AdherenceDashboard'>;

function buildMetrics(overrides: Partial<AdherenceMetrics> = {}): AdherenceMetrics {
  return {
    treatmentId: 'treatment-1',
    periodStart: new Date('2026-08-01'),
    periodEnd: new Date('2026-08-31'),
    totalScheduled: 10,
    totalTaken: 8,
    adherencePercentage: 80,
    estimatedDaysRemaining: 15,
    stockAlertLevel: StockAlertLevel.NORMAL,
    ...overrides,
  };
}

const baseRoute = { key: 'dash-1', name: 'AdherenceDashboard' as const, params: { treatmentId: 'treatment-1' } };
const navigation = { replace: jest.fn(), navigate: jest.fn(), goBack: jest.fn() } as unknown as Props['navigation'];

describe('AdherenceDashboardScreen', () => {
  it('muestra el porcentaje de adherencia y los días de stock restantes', async () => {
    const monitorAdherence = { execute: jest.fn().mockResolvedValue(Ok({ metrics: buildMetrics(), criticalAlertDispatched: false })) };

    await render(
      withProviders(<AdherenceDashboardScreen navigation={navigation} route={baseRoute} />, {
        role: 'CUIDADOR',
        useCases: { monitorAdherence: monitorAdherence as never },
      }),
    );

    await waitFor(() => expect(screen.getByText('80%')).toBeTruthy());
    expect(screen.getByText('8 de 10 tomas')).toBeTruthy();
    expect(screen.getByText('15 día(s)')).toBeTruthy();
    expect(screen.getByText('Stock normal')).toBeTruthy();
    expect(monitorAdherence.execute).toHaveBeenCalledWith({
      treatmentId: 'treatment-1',
      requestingCaregiverId: 'demo-caregiver-1',
    });
  });

  it('muestra la insignia CRITICAL cuando el stock está en nivel crítico', async () => {
    const monitorAdherence = {
      execute: jest
        .fn()
        .mockResolvedValue(Ok({ metrics: buildMetrics({ stockAlertLevel: StockAlertLevel.CRITICAL, estimatedDaysRemaining: 2 }), criticalAlertDispatched: true })),
    };

    await render(
      withProviders(<AdherenceDashboardScreen navigation={navigation} route={baseRoute} />, {
        role: 'CUIDADOR',
        useCases: { monitorAdherence: monitorAdherence as never },
      }),
    );

    await waitFor(() => expect(screen.getByText('Stock crítico — reponer ahora')).toBeTruthy());
  });

  it('al actualizar el stock, llama a UpdateStockUseCase y refresca las métricas', async () => {
    const monitorAdherence = {
      execute: jest
        .fn()
        .mockResolvedValueOnce(Ok({ metrics: buildMetrics({ stockAlertLevel: StockAlertLevel.CRITICAL }), criticalAlertDispatched: true }))
        .mockResolvedValueOnce(Ok({ metrics: buildMetrics({ stockAlertLevel: StockAlertLevel.NORMAL, estimatedDaysRemaining: 30 }), criticalAlertDispatched: false })),
    };
    const updateStock = {
      execute: jest.fn().mockResolvedValue(Ok({ stock: { currentQuantity: 30, dailyConsumption: 1, unit: 'UNIT', criticalThresholdDays: 3 }, stockAlertLevel: StockAlertLevel.NORMAL })),
    };
    const user = userEvent.setup();

    await render(
      withProviders(<AdherenceDashboardScreen navigation={navigation} route={baseRoute} />, {
        role: 'CUIDADOR',
        useCases: { monitorAdherence: monitorAdherence as never, updateStock: updateStock as never },
      }),
    );

    await waitFor(() => expect(screen.getByText('Stock crítico — reponer ahora')).toBeTruthy());

    await user.type(screen.getByLabelText('Nueva cantidad de stock disponible'), '30');
    await user.press(screen.getByText('Guardar'));

    await waitFor(() =>
      expect(updateStock.execute).toHaveBeenCalledWith({
        treatmentId: 'treatment-1',
        requestingCaregiverId: 'demo-caregiver-1',
        newQuantity: 30,
      }),
    );

    await waitFor(() => expect(monitorAdherence.execute).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByText('Stock normal')).toBeTruthy());
  });

  it('muestra un mensaje de error si no se pueden cargar las métricas', async () => {
    const monitorAdherence = { execute: jest.fn().mockResolvedValue(Err(DomainErrors.treatmentNotFound('treatment-1'))) };

    await render(
      withProviders(<AdherenceDashboardScreen navigation={navigation} route={baseRoute} />, {
        role: 'CUIDADOR',
        useCases: { monitorAdherence: monitorAdherence as never },
      }),
    );

    await waitFor(() => expect(screen.getByText('No pudimos cargar las métricas de este tratamiento.')).toBeTruthy());
  });
});
