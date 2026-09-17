import React from 'react';
import { render, screen, waitFor, userEvent } from '@testing-library/react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

/**
 * `CuidadorHomeScreen` usa `useFocusEffect` (se recarga cada vez que vuelve
 * a tener foco, p. ej. al volver de registrar un tratamiento) — ese hook
 * necesita un ancestro `NavigationContainer`/`Stack.Screen` real para
 * resolver el `navigation` de contexto, que este test no monta (pasa
 * `navigation`/`route` como props sueltas, igual que el resto de los tests
 * de pantalla). Se lo reduce acá a un efecto de montaje simple.
 */
jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  const ReactActual = jest.requireActual('react');
  return {
    ...actual,
    useFocusEffect: (effect: () => void) => ReactActual.useEffect(effect, []),
  };
});

import { CuidadorHomeScreen } from '../../src/presentation/screens/cuidador-home/CuidadorHomeScreen';
import type { CuidadorStackParamList } from '../../src/presentation/navigation/types';
import { Ok, Err, DomainErrors, PillShape, DoseStatus, StockAlertLevel } from '../../src/domain';
import type { GetWeeklyScheduleOutput } from '../../src/application';
import { withProviders } from './test-utils';

type Props = NativeStackScreenProps<CuidadorStackParamList, 'CuidadorHome'>;

function buildNavigationMock(): Props['navigation'] {
  return { navigate: jest.fn(), replace: jest.fn(), goBack: jest.fn() } as unknown as Props['navigation'];
}

const baseRoute = { key: 'cuidador-home-1', name: 'CuidadorHome' as const, params: undefined };

function buildWeeklySchedule(overrides: Partial<GetWeeklyScheduleOutput> = {}): GetWeeklyScheduleOutput {
  return {
    weekStart: new Date('2026-08-02T00:00:00.000'),
    weekEnd: new Date('2026-08-08T23:59:59.999'),
    doses: [],
    treatmentsNeedingAttention: [],
    adherencePercentage: 100,
    ...overrides,
  };
}

describe('CuidadorHomeScreen', () => {
  it('muestra el estado vacío y la grilla semanal (tocable) cuando no hay dosis en la semana', async () => {
    const getWeeklySchedule = { execute: jest.fn().mockResolvedValue(Ok(buildWeeklySchedule())) };
    const navigation = buildNavigationMock();

    await render(
      withProviders(<CuidadorHomeScreen navigation={navigation} route={baseRoute} />, {
        role: 'CUIDADOR',
        useCases: { getWeeklySchedule: getWeeklySchedule as never },
      }),
    );

    await waitFor(() => expect(screen.getByText('Todavía no registraste ningún tratamiento')).toBeTruthy());
    expect(screen.getByLabelText('Domingo · MAÑ — sin dosis programadas, tocá para agregar un tratamiento')).toBeTruthy();
  });

  it('si el Cuidador no tiene paciente vinculado, muestra el prompt de vinculación en vez de la semana', async () => {
    const getWeeklySchedule = { execute: jest.fn() };
    const navigation = buildNavigationMock();

    await render(
      withProviders(<CuidadorHomeScreen navigation={navigation} route={baseRoute} />, {
        role: 'CUIDADOR',
        patientId: '',
        useCases: { getWeeklySchedule: getWeeklySchedule as never },
      }),
    );

    expect(screen.getByText('Vinculá a tu Adulto Mayor')).toBeTruthy();
    expect(getWeeklySchedule.execute).not.toHaveBeenCalled();
  });

  it('muestra el banner de tratamientos que necesitan reponer stock', async () => {
    const schedule = buildWeeklySchedule({
      doses: [
        {
          doseId: 'd1',
          treatmentId: 't1',
          medicationName: 'Losartán',
          visualProfile: { shape: PillShape.ROUND, color: '#EB5757' },
          scheduledAt: new Date('2026-08-05T08:00:00.000'),
          status: DoseStatus.PENDING,
        },
      ],
      treatmentsNeedingAttention: [
        { treatmentId: 't1', medicationName: 'Losartán', stockAlertLevel: StockAlertLevel.CRITICAL, estimatedDaysRemaining: 2 },
        // Mismo medicamento, otro tratamiento: antes las dos filas se veían
        // idénticas y no había forma de saber cuál se estaba tocando.
        { treatmentId: 't2', medicationName: 'Losartán', stockAlertLevel: StockAlertLevel.CRITICAL, estimatedDaysRemaining: 0 },
      ],
    });
    const getWeeklySchedule = { execute: jest.fn().mockResolvedValue(Ok(schedule)) };
    const navigation = buildNavigationMock();

    await render(
      withProviders(<CuidadorHomeScreen navigation={navigation} route={baseRoute} />, {
        role: 'CUIDADOR',
        useCases: { getWeeklySchedule: getWeeklySchedule as never },
      }),
    );

    await waitFor(() => expect(screen.getByText('Necesitan reponer stock')).toBeTruthy());
    expect(screen.getAllByText('Losartán')).toHaveLength(2);
    expect(screen.getByText('quedan 2 días')).toBeTruthy();
    expect(screen.getByText('se acabó')).toBeTruthy();
  });

  it('tocar un casillero vacío y luego "Agregar tratamiento" navega a Registrar tratamiento con la hora sugerida del turno', async () => {
    const getWeeklySchedule = { execute: jest.fn().mockResolvedValue(Ok(buildWeeklySchedule())) };
    const navigation = buildNavigationMock();
    const user = userEvent.setup();

    await render(
      withProviders(<CuidadorHomeScreen navigation={navigation} route={baseRoute} />, {
        role: 'CUIDADOR',
        useCases: { getWeeklySchedule: getWeeklySchedule as never },
      }),
    );

    const emptyCellLabel = 'Domingo · TAR — sin dosis programadas, tocá para agregar un tratamiento';
    await waitFor(() => expect(screen.getByLabelText(emptyCellLabel)).toBeTruthy());
    await user.press(screen.getByLabelText(emptyCellLabel));

    await waitFor(() => expect(screen.getByText('Agregar tratamiento para este turno')).toBeTruthy());
    await user.press(screen.getByText('Agregar tratamiento para este turno'));

    expect(navigation.navigate).toHaveBeenCalledWith('RegisterTreatment', { suggestedHour: 14 });
  });

  it('tocar una celda con dosis abre el detalle, y desde ahí se puede ir a Adherencia', async () => {
    // Exactamente `weekStart` a las 08:00 -> cae en el bucket del primer día
    // (dayIndex 0, "Domingo" según `groupDosesByWeek`) sin depender de a qué
    // día de la semana calendario corresponde la fecha fija de arriba.
    const weekStart = new Date('2026-08-02T00:00:00.000');
    const scheduledAt = new Date(weekStart);
    scheduledAt.setHours(8, 0, 0, 0);
    const schedule = buildWeeklySchedule({
      weekStart,
      doses: [
        {
          doseId: 'd1',
          treatmentId: 't1',
          medicationName: 'Metformina',
          visualProfile: { shape: PillShape.OVAL, color: '#2D9CDB' },
          scheduledAt,
          status: DoseStatus.PENDING,
        },
      ],
    });
    const getWeeklySchedule = { execute: jest.fn().mockResolvedValue(Ok(schedule)) };
    const navigation = buildNavigationMock();
    const user = userEvent.setup();

    await render(
      withProviders(<CuidadorHomeScreen navigation={navigation} route={baseRoute} />, {
        role: 'CUIDADOR',
        useCases: { getWeeklySchedule: getWeeklySchedule as never },
      }),
    );

    await waitFor(() => expect(screen.getByLabelText('Domingo · MAÑ — 1 medicamento')).toBeTruthy());
    await user.press(screen.getByLabelText('Domingo · MAÑ — 1 medicamento'));

    await waitFor(() => expect(screen.getByText('Metformina')).toBeTruthy());
    await user.press(screen.getByLabelText('Ver adherencia y stock de Metformina'));

    expect(navigation.navigate).toHaveBeenCalledWith('AdherenceDashboard', { treatmentId: 't1' });
  });

  /**
   * Pausar un tratamiento lo saca de la grilla y del aviso de stock — que
   * es lo que se le pide a una pausa. Sin esta lista no quedaba NINGÚN
   * camino en la app para volver a abrirlo y reanudarlo.
   */
  it('lista los tratamientos en pausa y deja volver a ellos', async () => {
    const getWeeklySchedule = { execute: jest.fn().mockResolvedValue(Ok(buildWeeklySchedule())) };
    const getPausedTreatments = {
      execute: jest.fn().mockResolvedValue(Ok({ treatments: [{ treatmentId: 't-pausado', medicationName: 'Ibuprofeno' }] })),
    };
    const navigation = buildNavigationMock();
    const user = userEvent.setup();

    await render(
      withProviders(<CuidadorHomeScreen navigation={navigation} route={baseRoute} />, {
        role: 'CUIDADOR',
        useCases: { getWeeklySchedule: getWeeklySchedule as never, getPausedTreatments: getPausedTreatments as never },
      }),
    );

    await waitFor(() => expect(screen.getByText('Ibuprofeno')).toBeTruthy());
    await user.press(screen.getByLabelText('Reanudar o ver Ibuprofeno, en pausa'));

    expect(navigation.navigate).toHaveBeenCalledWith('AdherenceDashboard', { treatmentId: 't-pausado' });
  });

  it('sin tratamientos en pausa no muestra la sección', async () => {
    const getWeeklySchedule = { execute: jest.fn().mockResolvedValue(Ok(buildWeeklySchedule())) };
    const navigation = buildNavigationMock();

    await render(
      withProviders(<CuidadorHomeScreen navigation={navigation} route={baseRoute} />, {
        role: 'CUIDADOR',
        useCases: { getWeeklySchedule: getWeeklySchedule as never },
      }),
    );

    await waitFor(() => expect(screen.getByText('Todavía no registraste ningún tratamiento')).toBeTruthy());
    expect(screen.queryByText('En pausa')).toBeNull();
  });

  it('el error ofrece un botón para reintentar, no solo el pedido de reintentar', async () => {
    const getWeeklySchedule = {
      execute: jest
        .fn()
        .mockResolvedValueOnce(Err(DomainErrors.repositoryFailure(new Error('sin red'))))
        .mockResolvedValueOnce(Ok(buildWeeklySchedule())),
    };
    const navigation = buildNavigationMock();
    const user = userEvent.setup();

    await render(
      withProviders(<CuidadorHomeScreen navigation={navigation} route={baseRoute} />, {
        role: 'CUIDADOR',
        useCases: { getWeeklySchedule: getWeeklySchedule as never },
      }),
    );

    await waitFor(() => expect(screen.getByText('No pudimos cargar tu semana.')).toBeTruthy());
    await user.press(screen.getByText('Reintentar'));

    await waitFor(() => expect(screen.getByText('Todavía no registraste ningún tratamiento')).toBeTruthy());
  });
});