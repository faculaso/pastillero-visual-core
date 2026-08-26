import React from 'react';
import { render, screen, waitFor, userEvent } from '@testing-library/react-native';
import { PastilleroVirtualScreen } from '../../src/presentation/screens/pastillero-virtual/PastilleroVirtualScreen';
import { PillShape, MeasurementUnit, Ok, Err, DomainErrors } from '../../src/domain';
import { withProviders } from './test-utils';
import type { PendingDoseView } from '../../src/application';

function buildNavigationMock() {
  return { navigate: jest.fn(), goBack: jest.fn() } as unknown as Parameters<typeof PastilleroVirtualScreen>[0]['navigation'];
}

function buildDoseView(overrides: Partial<PendingDoseView> = {}): PendingDoseView {
  return {
    doseId: 'dose-1',
    treatmentId: 'treatment-1',
    scheduledAt: new Date('2026-08-01T08:00:00.000Z'),
    medicationName: 'Paracetamol',
    visualProfile: { shape: PillShape.ROUND, color: '#FFFFFF' },
    dosagePerTake: { amount: 1, unit: MeasurementUnit.UNIT },
    ...overrides,
  };
}

describe('PastilleroVirtualScreen', () => {
  it('muestra la toma pendiente tras cargar', async () => {
    const getPendingDoses = { execute: jest.fn().mockResolvedValue(Ok({ doses: [buildDoseView()] })) };

    await render(
      withProviders(<PastilleroVirtualScreen patientId="patient-1" navigation={buildNavigationMock()} />, {
        useCases: { getPendingDoses: getPendingDoses as never },
      }),
    );

    await waitFor(() => expect(screen.getByText('Paracetamol')).toBeTruthy());
    expect(getPendingDoses.execute).toHaveBeenCalledWith({ patientId: 'patient-1' });
  });

  it('muestra el badge de turno "Mañana" y tiñe la pantalla para una toma matutina', async () => {
    const getPendingDoses = {
      execute: jest.fn().mockResolvedValue(Ok({ doses: [buildDoseView({ scheduledAt: new Date('2026-08-01T08:00:00') })] })),
    };

    await render(
      withProviders(<PastilleroVirtualScreen patientId="patient-1" navigation={buildNavigationMock()} />, {
        useCases: { getPendingDoses: getPendingDoses as never },
      }),
    );

    await waitFor(() => expect(screen.getByText(/Mañana/)).toBeTruthy());
    expect(screen.getByText('Tomar con agua')).toBeTruthy();
  });

  it('muestra el badge de turno "Tarde" para una toma de la tarde', async () => {
    const getPendingDoses = {
      execute: jest.fn().mockResolvedValue(Ok({ doses: [buildDoseView({ scheduledAt: new Date('2026-08-01T14:00:00') })] })),
    };

    await render(
      withProviders(<PastilleroVirtualScreen patientId="patient-1" navigation={buildNavigationMock()} />, {
        useCases: { getPendingDoses: getPendingDoses as never },
      }),
    );

    await waitFor(() => expect(screen.getByText(/Tarde/)).toBeTruthy());
    expect(screen.getByText('Tomar después de comer')).toBeTruthy();
  });

  it('muestra el badge de turno "Noche" para una toma nocturna', async () => {
    const getPendingDoses = {
      execute: jest.fn().mockResolvedValue(Ok({ doses: [buildDoseView({ scheduledAt: new Date('2026-08-01T21:00:00') })] })),
    };

    await render(
      withProviders(<PastilleroVirtualScreen patientId="patient-1" navigation={buildNavigationMock()} />, {
        useCases: { getPendingDoses: getPendingDoses as never },
      }),
    );

    await waitFor(() => expect(screen.getByText(/Noche/)).toBeTruthy());
    expect(screen.getByText('Tomar antes de dormir')).toBeTruthy();
  });

  it('muestra el botón de accesibilidad auditiva "Escuchar indicaciones" junto a la toma pendiente', async () => {
    const getPendingDoses = { execute: jest.fn().mockResolvedValue(Ok({ doses: [buildDoseView()] })) };

    await render(
      withProviders(<PastilleroVirtualScreen patientId="patient-1" navigation={buildNavigationMock()} />, {
        useCases: { getPendingDoses: getPendingDoses as never },
      }),
    );

    await waitFor(() => expect(screen.getByText('Escuchar indicaciones')).toBeTruthy());
  });

  it('muestra el estado vacío si no hay tomas pendientes', async () => {
    const getPendingDoses = { execute: jest.fn().mockResolvedValue(Ok({ doses: [] })) };

    await render(
      withProviders(<PastilleroVirtualScreen patientId="patient-1" navigation={buildNavigationMock()} />, {
        useCases: { getPendingDoses: getPendingDoses as never },
      }),
    );

    await waitFor(() => expect(screen.getByText('Por ahora no tenés tomas pendientes')).toBeTruthy());
  });

  it('al confirmar exitosamente, quita la toma de la lista y muestra el estado vacío', async () => {
    const getPendingDoses = { execute: jest.fn().mockResolvedValue(Ok({ doses: [buildDoseView()] })) };
    const confirmDose = { execute: jest.fn().mockResolvedValue(Ok({ dose: {}, stock: {} })) };
    const user = userEvent.setup();

    await render(
      withProviders(<PastilleroVirtualScreen patientId="patient-1" navigation={buildNavigationMock()} />, {
        useCases: { getPendingDoses: getPendingDoses as never, confirmDose: confirmDose as never },
      }),
    );

    await waitFor(() => expect(screen.getByText('Paracetamol')).toBeTruthy());
    await user.press(screen.getByText('Confirmar Toma'));

    await waitFor(() =>
      expect(confirmDose.execute).toHaveBeenCalledWith({ doseId: 'dose-1', requestingPatientId: 'patient-1' }),
    );
    await waitFor(() => expect(screen.getByText('Por ahora no tenés tomas pendientes')).toBeTruthy());
  });

  it('dos tomas a la misma hora se pueden navegar deslizando — confirmar una no afecta a la otra', async () => {
    const doseA = buildDoseView({ doseId: 'dose-a', medicationName: 'Paracetamol' });
    const doseB = buildDoseView({ doseId: 'dose-b', medicationName: 'Ibuprofeno' });
    const getPendingDoses = { execute: jest.fn().mockResolvedValue(Ok({ doses: [doseA, doseB] })) };
    const confirmDose = { execute: jest.fn().mockResolvedValue(Ok({ dose: {}, stock: {} })) };
    const user = userEvent.setup();

    await render(
      withProviders(<PastilleroVirtualScreen patientId="patient-1" navigation={buildNavigationMock()} />, {
        useCases: { getPendingDoses: getPendingDoses as never, confirmDose: confirmDose as never },
      }),
    );

    await waitFor(() => expect(screen.getByText('Paracetamol')).toBeTruthy());
    expect(screen.getByText('Ibuprofeno')).toBeTruthy();
    expect(screen.getByText(/Deslizá para ver la otra pastilla/)).toBeTruthy();

    // Confirma la PRIMERA (índice actual del carrusel) — no la segunda.
    await user.press(screen.getByText('Confirmar Toma'));
    await waitFor(() =>
      expect(confirmDose.execute).toHaveBeenCalledWith({ doseId: 'dose-a', requestingPatientId: 'patient-1' }),
    );

    // La segunda toma sigue pendiente, y al quedar sola ya no hace falta la pista de deslizar.
    await waitFor(() => expect(screen.getByText('Ibuprofeno')).toBeTruthy());
    expect(screen.queryByText('Paracetamol')).toBeNull();
    expect(screen.queryByText(/Deslizá para ver la otra pastilla/)).toBeNull();
  });

  it('si la confirmación falla, muestra el ErrorBanner y NO quita la toma de la lista', async () => {
    const getPendingDoses = { execute: jest.fn().mockResolvedValue(Ok({ doses: [buildDoseView()] })) };
    const confirmDose = {
      execute: jest.fn().mockResolvedValue(Err(DomainErrors.insufficientStock('treatment-1'))),
    };
    const user = userEvent.setup();

    await render(
      withProviders(<PastilleroVirtualScreen patientId="patient-1" navigation={buildNavigationMock()} />, {
        useCases: { getPendingDoses: getPendingDoses as never, confirmDose: confirmDose as never },
      }),
    );

    await waitFor(() => expect(screen.getByText('Paracetamol')).toBeTruthy());
    await user.press(screen.getByText('Confirmar Toma'));

    await waitFor(() =>
      expect(
        screen.getByText('No hay stock suficiente registrado. Avisale a tu cuidador para reponer la medicación.'),
      ).toBeTruthy(),
    );
    expect(screen.getByText('Paracetamol')).toBeTruthy();
  });

  it('el botón "Entendido" del error limpia el mensaje y vuelve a mostrar la toma pendiente', async () => {
    const getPendingDoses = { execute: jest.fn().mockResolvedValue(Ok({ doses: [buildDoseView()] })) };
    const confirmDose = { execute: jest.fn().mockResolvedValue(Err(DomainErrors.doseAlreadyConfirmed('dose-1'))) };
    const user = userEvent.setup();

    await render(
      withProviders(<PastilleroVirtualScreen patientId="patient-1" navigation={buildNavigationMock()} />, {
        useCases: { getPendingDoses: getPendingDoses as never, confirmDose: confirmDose as never },
      }),
    );

    await waitFor(() => expect(screen.getByText('Paracetamol')).toBeTruthy());
    await user.press(screen.getByText('Confirmar Toma'));
    await waitFor(() => expect(screen.getByText('Entendido')).toBeTruthy());

    await user.press(screen.getByText('Entendido'));
    await waitFor(() => expect(screen.getByText('Confirmar Toma')).toBeTruthy());
  });

  it('el botón "Mi código" muestra el código de invitación del Adulto Mayor', async () => {
    const getPendingDoses = { execute: jest.fn().mockResolvedValue(Ok({ doses: [] })) };
    const getProfile = {
      execute: jest.fn().mockResolvedValue(
        Ok({ profile: { id: 'patient-1', role: 'ADULTO_MAYOR', displayName: 'Rosa', inviteCode: '7F2K9M' } }),
      ),
    };
    const user = userEvent.setup();

    await render(
      withProviders(<PastilleroVirtualScreen patientId="patient-1" navigation={buildNavigationMock()} />, {
        useCases: { getPendingDoses: getPendingDoses as never, getProfile: getProfile as never },
      }),
    );

    await user.press(screen.getByLabelText('Ver mi código de invitación'));

    await waitFor(() => expect(getProfile.execute).toHaveBeenCalledWith({ userId: 'patient-1' }));
    await waitFor(() => expect(screen.getByText('7F2K9M')).toBeTruthy());
  });
});
