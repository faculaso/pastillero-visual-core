import React from 'react';
import { render, screen, waitFor, userEvent } from '@testing-library/react-native';
import { MiSemanaScreen } from '../../src/presentation/screens/mi-semana/MiSemanaScreen';
import { Ok, PillShape, DoseStatus } from '../../src/domain';
import type { GetWeeklyScheduleOutput } from '../../src/application';
import { withProviders } from './test-utils';

function currentWeekStart(): Date {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function todayAt(hour: number): Date {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  return d;
}

function buildSchedule(overrides: Partial<GetWeeklyScheduleOutput> = {}): GetWeeklyScheduleOutput {
  const weekStart = currentWeekStart();
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  return {
    weekStart,
    weekEnd,
    doses: [],
    treatmentsNeedingAttention: [],
    adherencePercentage: 100,
    ...overrides,
  };
}

function buildNavigationMock() {
  return { navigate: jest.fn(), goBack: jest.fn() } as unknown as Parameters<typeof MiSemanaScreen>[0]['navigation'];
}

describe('MiSemanaScreen', () => {
  it('muestra los 7 días de la semana con "Hoy" en el día actual', async () => {
    const getWeeklySchedule = { execute: jest.fn().mockResolvedValue(Ok(buildSchedule())) };
    const navigation = buildNavigationMock();

    await render(
      withProviders(<MiSemanaScreen patientId="patient-1" navigation={navigation} />, {
        useCases: { getWeeklySchedule: getWeeklySchedule as never },
      }),
    );

    await waitFor(() => expect(screen.getByText(/· Hoy/)).toBeTruthy());
    expect(getWeeklySchedule.execute).toHaveBeenCalledWith({ patientId: 'patient-1' });
  });

  it('el botón de volver llama a navigation.goBack()', async () => {
    const getWeeklySchedule = { execute: jest.fn().mockResolvedValue(Ok(buildSchedule())) };
    const navigation = buildNavigationMock();
    const user = userEvent.setup();

    await render(
      withProviders(<MiSemanaScreen patientId="patient-1" navigation={navigation} />, {
        useCases: { getWeeklySchedule: getWeeklySchedule as never },
      }),
    );

    await waitFor(() => expect(screen.getByText('Mi semana')).toBeTruthy());
    await user.press(screen.getByLabelText('Volver'));

    expect(navigation.goBack).toHaveBeenCalled();
  });

  it('una toma pendiente de hoy es tocable y navega de vuelta al pastillero principal', async () => {
    const schedule = buildSchedule({
      doses: [
        {
          doseId: 'd1',
          treatmentId: 't1',
          medicationName: 'Ibuprofeno',
          visualProfile: { shape: PillShape.OVAL, color: '#FFC6A5' },
          scheduledAt: todayAt(8),
          status: DoseStatus.PENDING,
        },
      ],
    });
    const getWeeklySchedule = { execute: jest.fn().mockResolvedValue(Ok(schedule)) };
    const navigation = buildNavigationMock();
    const user = userEvent.setup();

    await render(
      withProviders(<MiSemanaScreen patientId="patient-1" navigation={navigation} />, {
        useCases: { getWeeklySchedule: getWeeklySchedule as never },
      }),
    );

    const label = 'Mañana, pendiente — tocá para ir a confirmarla';
    await waitFor(() => expect(screen.getByLabelText(label)).toBeTruthy());
    await user.press(screen.getByLabelText(label));

    expect(navigation.navigate).toHaveBeenCalledWith('PastilleroVirtual');
  });

  it('un turno sin dosis programadas de hoy no es interactivo', async () => {
    const getWeeklySchedule = { execute: jest.fn().mockResolvedValue(Ok(buildSchedule())) };
    const navigation = buildNavigationMock();

    await render(
      withProviders(<MiSemanaScreen patientId="patient-1" navigation={navigation} />, {
        useCases: { getWeeklySchedule: getWeeklySchedule as never },
      }),
    );

    await waitFor(() => expect(screen.getAllByText('Sin dosis programadas').length).toBeGreaterThan(0));
    expect(screen.queryByLabelText(/pendiente — tocá para ir a confirmarla/)).toBeNull();
  });
});
