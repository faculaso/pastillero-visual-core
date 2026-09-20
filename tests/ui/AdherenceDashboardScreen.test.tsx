import React from 'react';
import { render, screen, waitFor, userEvent } from '@testing-library/react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AdherenceDashboardScreen } from '../../src/presentation/screens/adherence-dashboard/AdherenceDashboardScreen';
import type { CuidadorStackParamList } from '../../src/presentation/navigation/types';
import { Ok, Err, DomainErrors, StockAlertLevel, MeasurementUnit, TreatmentStatus } from '../../src/domain';
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

/**
 * `MonitorAdherenceOutput` ahora también trae de QUÉ tratamiento son las
 * métricas y el stock completo — la pantalla necesita nombrar el
 * medicamento y decir cuánto hay antes de pedir una cantidad nueva.
 */
function buildOutput(overrides: Record<string, unknown> = {}) {
  return {
    metrics: buildMetrics(),
    medicationName: 'Paracetamol',
    stock: {
      currentQuantity: 30,
      dailyConsumption: 2,
      unit: MeasurementUnit.UNIT,
      criticalThresholdDays: 3,
    },
    status: TreatmentStatus.ACTIVE,
    criticalAlertDispatched: false,
    ...overrides,
  };
}

const baseRoute = { key: 'dash-1', name: 'AdherenceDashboard' as const, params: { treatmentId: 'treatment-1' } };
const navigation = { replace: jest.fn(), navigate: jest.fn(), goBack: jest.fn() } as unknown as Props['navigation'];

describe('AdherenceDashboardScreen', () => {
  it('muestra el porcentaje de adherencia y los días de stock restantes', async () => {
    const monitorAdherence = { execute: jest.fn().mockResolvedValue(Ok(buildOutput())) };

    await render(
      withProviders(<AdherenceDashboardScreen navigation={navigation} route={baseRoute} />, {
        role: 'CUIDADOR',
        useCases: { monitorAdherence: monitorAdherence as never },
      }),
    );

    await waitFor(() => expect(screen.getByText('80%')).toBeTruthy());
    // El nombre del medicamento titula la pantalla: se llega desde una lista
    // donde dos tratamientos pueden mostrar el mismo nombre comercial, y acá
    // abajo hay un formulario que le cambia el stock.
    expect(screen.getByText('Paracetamol')).toBeTruthy();
    // Nivel de adherencia en texto, no solo en color.
    expect(screen.getByText('Al día')).toBeTruthy();
    // Cuánto hay hoy y en qué unidad, antes de pedir una cantidad nueva.
    expect(screen.getByText('Ahora hay 30 comprimidos. Escribí cuánto queda en total después de reponer.')).toBeTruthy();
    expect(screen.getByText('8 de 10 tomas')).toBeTruthy();
    expect(screen.getByText('15 días')).toBeTruthy();
    expect(screen.getByText('Stock normal')).toBeTruthy();
    expect(monitorAdherence.execute).toHaveBeenCalledWith({
      treatmentId: 'treatment-1',
      requestingCaregiverId: 'test-caregiver-1',
    });
  });

  it('muestra la insignia CRITICAL cuando el stock está en nivel crítico', async () => {
    const monitorAdherence = {
      execute: jest
        .fn()
        .mockResolvedValue(Ok(buildOutput({ metrics: buildMetrics({ stockAlertLevel: StockAlertLevel.CRITICAL, estimatedDaysRemaining: 2 }), criticalAlertDispatched: true }))),
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
        .mockResolvedValueOnce(Ok(buildOutput({ metrics: buildMetrics({ stockAlertLevel: StockAlertLevel.CRITICAL }), criticalAlertDispatched: true })))
        .mockResolvedValueOnce(Ok(buildOutput({ metrics: buildMetrics({ stockAlertLevel: StockAlertLevel.NORMAL, estimatedDaysRemaining: 30 }) }))),
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

    await user.type(screen.getByLabelText('Nueva cantidad total de stock. Ahora hay 30 comprimidos'), '30');
    await user.press(screen.getByText('Guardar'));

    await waitFor(() =>
      expect(updateStock.execute).toHaveBeenCalledWith({
        treatmentId: 'treatment-1',
        requestingCaregiverId: 'test-caregiver-1',
        newQuantity: 30,
      }),
    );

    await waitFor(() => expect(monitorAdherence.execute).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByText('Stock normal')).toBeTruthy());
  });

  /**
   * Hasta acá el Cuidador no tenía NINGUNA forma de apagar un remedio que
   * el médico suspendió: seguía sonando para siempre y lo único parecido
   * era borrarlo, que se lleva puesto el historial de adherencia.
   */
  describe('pausar, reanudar y dar de baja', () => {
    function okCambio(overrides: Record<string, unknown> = {}) {
      return Ok({ treatment: {}, alarmsAffected: 1, alarmWarnings: [], ...overrides });
    }

    it('pausar no pide confirmación: es reversible de un toque', async () => {
      const monitorAdherence = {
        execute: jest
          .fn()
          .mockResolvedValueOnce(Ok(buildOutput()))
          .mockResolvedValueOnce(Ok(buildOutput({ status: TreatmentStatus.PAUSED }))),
      };
      const changeTreatmentStatus = { execute: jest.fn().mockResolvedValue(okCambio()) };
      const user = userEvent.setup();

      await render(
        withProviders(<AdherenceDashboardScreen navigation={navigation} route={baseRoute} />, {
          role: 'CUIDADOR',
          useCases: { monitorAdherence: monitorAdherence as never, changeTreatmentStatus: changeTreatmentStatus as never },
        }),
      );

      await waitFor(() => expect(screen.getByText('Pausar tratamiento')).toBeTruthy());
      await user.press(screen.getByText('Pausar tratamiento'));

      await waitFor(() =>
        expect(changeTreatmentStatus.execute).toHaveBeenCalledWith({
          treatmentId: 'treatment-1',
          requestingCaregiverId: 'test-caregiver-1',
          newStatus: TreatmentStatus.PAUSED,
        }),
      );
      // El cartel explica la consecuencia, no repite el nombre del estado.
      await waitFor(() => expect(screen.getByText('En pausa')).toBeTruthy());
      expect(screen.getByText('Reanudar tratamiento')).toBeTruthy();
    });

    it('dar de baja PIDE confirmación antes de tocar nada', async () => {
      const monitorAdherence = { execute: jest.fn().mockResolvedValue(Ok(buildOutput())) };
      const changeTreatmentStatus = { execute: jest.fn().mockResolvedValue(okCambio()) };
      const user = userEvent.setup();

      await render(
        withProviders(<AdherenceDashboardScreen navigation={navigation} route={baseRoute} />, {
          role: 'CUIDADOR',
          useCases: { monitorAdherence: monitorAdherence as never, changeTreatmentStatus: changeTreatmentStatus as never },
        }),
      );

      await waitFor(() => expect(screen.getByText('Dar de baja')).toBeTruthy());
      await user.press(screen.getByText('Dar de baja'));

      // Nada se ejecuta hasta que la persona confirma en el cartel.
      expect(changeTreatmentStatus.execute).not.toHaveBeenCalled();
      expect(screen.getByText('Dar de baja el tratamiento')).toBeTruthy();
      // El medicamento se nombra: dar de baja el equivocado no tiene vuelta atrás.
      expect(screen.getByText(/^Paracetamol deja de sonar/)).toBeTruthy();

      // "Dar de baja" está dos veces: el botón de la pantalla y el del cartel,
      // que se monta después. El del cartel es el último.
      const confirmaciones = screen.getAllByLabelText('Dar de baja');
      const enElCartel = confirmaciones[confirmaciones.length - 1];
      if (!enElCartel) throw new Error('el cartel no montó su botón de confirmar');
      await user.press(enElCartel);

      await waitFor(() =>
        expect(changeTreatmentStatus.execute).toHaveBeenCalledWith({
          treatmentId: 'treatment-1',
          requestingCaregiverId: 'test-caregiver-1',
          newStatus: TreatmentStatus.CANCELLED,
        }),
      );
      // Volver al pastillero ES el comprobante: el medicamento ya no está en la grilla.
      await waitFor(() => expect(navigation.goBack).toHaveBeenCalled());
    });

    it('avisa cuando quedaron alarmas sin apagar — es lo único peor que no haber hecho nada', async () => {
      const monitorAdherence = { execute: jest.fn().mockResolvedValue(Ok(buildOutput())) };
      const changeTreatmentStatus = {
        execute: jest.fn().mockResolvedValue(okCambio({ alarmsAffected: 0, alarmWarnings: ['dose-1'] })),
      };
      const user = userEvent.setup();

      await render(
        withProviders(<AdherenceDashboardScreen navigation={navigation} route={baseRoute} />, {
          role: 'CUIDADOR',
          useCases: { monitorAdherence: monitorAdherence as never, changeTreatmentStatus: changeTreatmentStatus as never },
        }),
      );

      await waitFor(() => expect(screen.getByText('Pausar tratamiento')).toBeTruthy());
      await user.press(screen.getByText('Pausar tratamiento'));

      await waitFor(() =>
        expect(
          screen.getByText(
            'El tratamiento cambió de estado, pero quedaron alarmas sin apagar. Reiniciá la app para que se actualicen.',
          ),
        ).toBeTruthy(),
      );
    });

    it('a un tratamiento dado de baja no le ofrece acciones ni formulario de stock', async () => {
      const monitorAdherence = {
        execute: jest.fn().mockResolvedValue(Ok(buildOutput({ status: TreatmentStatus.CANCELLED }))),
      };

      await render(
        withProviders(<AdherenceDashboardScreen navigation={navigation} route={baseRoute} />, {
          role: 'CUIDADOR',
          useCases: { monitorAdherence: monitorAdherence as never },
        }),
      );

      await waitFor(() => expect(screen.getByText('Dado de baja')).toBeTruthy());
      expect(screen.queryByText('Pausar tratamiento')).toBeNull();
      expect(screen.queryByText('Reanudar tratamiento')).toBeNull();
      expect(screen.queryByText('Dar de baja')).toBeNull();
      // De un tratamiento terminado no se compra más: el formulario sobra.
      expect(screen.queryByText('Guardar')).toBeNull();
    });
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
