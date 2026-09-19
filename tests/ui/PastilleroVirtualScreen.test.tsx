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
    caregiverName: 'Ana',
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

  /**
   * El stock lo carga el Cuidador a mano y es una estimación; que la
   * pastilla se haya tomado es un hecho. Antes, quedarse sin stock
   * registrado devolvía STOCK_INSUFFICIENT y la toma NO se registraba: un
   * olvido de inventario convertía una toma real en un incumplimiento y le
   * mostraba un error al Adulto Mayor frente a una pastilla ya tomada.
   */
  it('si el stock no alcanzaba, la toma se registra igual y el aviso NO tapa el botón', async () => {
    const doseA = buildDoseView({ doseId: 'dose-a', medicationName: 'Paracetamol' });
    const doseB = buildDoseView({ doseId: 'dose-b', medicationName: 'Ibuprofeno', scheduledAt: new Date('2026-08-01T20:00:00.000Z') });
    const getPendingDoses = { execute: jest.fn().mockResolvedValue(Ok({ doses: [doseA, doseB] })) };
    const confirmDose = {
      execute: jest.fn().mockResolvedValue(Ok({ dose: {}, stock: {}, stockWasShort: true })),
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
      expect(screen.getByText('Quedó registrada. Avisale a tu cuidador que se terminó este remedio.')).toBeTruthy(),
    );
    // La toma salió de la lista: se registró de verdad, no es un error.
    await waitFor(() => expect(screen.getByText('Ibuprofeno')).toBeTruthy());
    // Y a diferencia del ErrorBanner, el aviso convive con el botón.
    expect(screen.getByText('Confirmar Toma')).toBeTruthy();
  });

  it('con stock suficiente no aparece ningún aviso', async () => {
    const getPendingDoses = { execute: jest.fn().mockResolvedValue(Ok({ doses: [buildDoseView()] })) };
    const confirmDose = {
      execute: jest.fn().mockResolvedValue(Ok({ dose: {}, stock: {}, stockWasShort: false })),
    };
    const user = userEvent.setup();

    await render(
      withProviders(<PastilleroVirtualScreen patientId="patient-1" navigation={buildNavigationMock()} />, {
        useCases: { getPendingDoses: getPendingDoses as never, confirmDose: confirmDose as never },
      }),
    );

    await waitFor(() => expect(screen.getByText('Paracetamol')).toBeTruthy());
    await user.press(screen.getByText('Confirmar Toma'));

    await waitFor(() => expect(screen.getByText('Por ahora no tenés tomas pendientes')).toBeTruthy());
    expect(screen.queryByText('Quedó registrada. Avisale a tu cuidador que se terminó este remedio.')).toBeNull();
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

  it('el botón "Mi código" abre la pantalla de cuidadores y códigos', async () => {
    // Antes abría un modal con EL código. Con hasta tres códigos, la baja de
    // cada uno y la lista de quién te cuida, eso pasó a ser una pantalla.
    const getPendingDoses = { execute: jest.fn().mockResolvedValue(Ok({ doses: [] })) };
    const navigation = buildNavigationMock();
    const user = userEvent.setup();

    await render(
      withProviders(<PastilleroVirtualScreen patientId="patient-1" navigation={navigation} />, {
        useCases: { getPendingDoses: getPendingDoses as never },
      }),
    );

    await user.press(screen.getByLabelText('Mi código y quién me cuida'));

    expect(navigation.navigate).toHaveBeenCalledWith('MisCuidadores');
  });

  it('completa el horizonte de dosis sin bloquear la primera lectura, y recarga solo si creó tomas', async () => {
    // Un tratamiento crónico se quedaba sin tomas a los 30 días del alta.
    // El completado hace una consulta por tratamiento activo, así que
    // encadenarlo ANTES de leer dejaba el pastillero vacío en pantalla
    // varios segundos — justo lo que no puede pasar en esta pantalla.
    const extendDoseHorizon = {
      execute: jest.fn().mockResolvedValue({ ok: true, value: { createdCount: 3, alarmWarnings: [] } }),
    };
    const getPendingDoses = { execute: jest.fn().mockResolvedValue(Ok({ doses: [] })) };

    await render(
      withProviders(<PastilleroVirtualScreen patientId="patient-1" navigation={buildNavigationMock()} />, {
        useCases: {
          extendDoseHorizon: extendDoseHorizon as never,
          getPendingDoses: getPendingDoses as never,
          getDailyProgress: { execute: jest.fn().mockResolvedValue(Ok({ totalScheduled: 0, totalTaken: 0 })) } as never,
        },
      }),
    );

    expect(extendDoseHorizon.execute).toHaveBeenCalledWith({ patientId: 'patient-1' });
    // Dos lecturas: la inmediata y la de refresco, porque creó tomas.
    await waitFor(() => expect(getPendingDoses.execute).toHaveBeenCalledTimes(2));
  });

  it('no vuelve a leer si no había nada que completar — el caso normal', async () => {
    const extendDoseHorizon = {
      execute: jest.fn().mockResolvedValue({ ok: true, value: { createdCount: 0, alarmWarnings: [] } }),
    };
    const getPendingDoses = { execute: jest.fn().mockResolvedValue(Ok({ doses: [] })) };

    await render(
      withProviders(<PastilleroVirtualScreen patientId="patient-1" navigation={buildNavigationMock()} />, {
        useCases: {
          extendDoseHorizon: extendDoseHorizon as never,
          getPendingDoses: getPendingDoses as never,
          getDailyProgress: { execute: jest.fn().mockResolvedValue(Ok({ totalScheduled: 0, totalTaken: 0 })) } as never,
        },
      }),
    );

    await waitFor(() => expect(extendDoseHorizon.execute).toHaveBeenCalled());
    expect(getPendingDoses.execute).toHaveBeenCalledTimes(1);
  });
});
