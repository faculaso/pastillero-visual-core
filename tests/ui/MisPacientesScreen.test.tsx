import React from 'react';
import { render, screen, waitFor, userEvent } from '@testing-library/react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

/**
 * La pantalla usa `useFocusEffect` (se recarga al volver de la semana de un
 * paciente, o después de vincular a otro) — ese hook necesita un
 * `NavigationContainer` real, que este test no monta: pasa `navigation` como
 * prop suelta, igual que el resto de los tests de pantalla.
 */
jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  const ReactActual = jest.requireActual('react');
  return {
    ...actual,
    useFocusEffect: (effect: () => void) => ReactActual.useEffect(effect, []),
  };
});

import { MisPacientesScreen } from '../../src/presentation/screens/mis-pacientes/MisPacientesScreen';
import type { CuidadorStackParamList } from '../../src/presentation/navigation/types';
import { Ok, Err, DomainErrors } from '../../src/domain';
import { withProviders } from './test-utils';

type Props = NativeStackScreenProps<CuidadorStackParamList, 'MisPacientes'>;

function buildNavigationMock(): Props['navigation'] {
  return { navigate: jest.fn(), replace: jest.fn(), goBack: jest.fn() } as unknown as Props['navigation'];
}

const baseRoute = { key: 'mis-pacientes-1', name: 'MisPacientes' as const, params: undefined };

function paciente(id: string, nombre: string | null) {
  return { patientId: id, displayName: nombre, linkedAt: new Date('2026-09-01T10:00:00Z') };
}

describe('MisPacientesScreen', () => {
  it('lista por nombre a todos los pacientes, no solo al primero', async () => {
    // El bug que motiva la pantalla: con dos personas a cargo, la sesión
    // elegía sola el primer vínculo y la segunda era invisible en la app.
    const getLinkedPatients = {
      execute: jest.fn().mockResolvedValue(Ok({ patients: [paciente('p1', 'Rosa'), paciente('p2', 'Hugo')] })),
    };

    await render(
      withProviders(<MisPacientesScreen navigation={buildNavigationMock()} route={baseRoute} />, {
        role: 'CUIDADOR',
        patientId: '',
        useCases: { getLinkedPatients: getLinkedPatients as never },
      }),
    );

    await waitFor(() => expect(screen.getByText('Rosa')).toBeTruthy());
    expect(screen.getByText('Hugo')).toBeTruthy();
    expect(screen.getByText(/Cuidás a 2 personas\./)).toBeTruthy();
  });

  it('tocar un paciente abre su semana', async () => {
    const getLinkedPatients = {
      execute: jest.fn().mockResolvedValue(Ok({ patients: [paciente('p1', 'Rosa'), paciente('p2', 'Hugo')] })),
    };
    const navigation = buildNavigationMock();
    const user = userEvent.setup();

    await render(
      withProviders(<MisPacientesScreen navigation={navigation} route={baseRoute} />, {
        role: 'CUIDADOR',
        patientId: '',
        useCases: { getLinkedPatients: getLinkedPatients as never },
      }),
    );

    await waitFor(() => expect(screen.getByLabelText('Gestionar a Hugo')).toBeTruthy());
    await user.press(screen.getByLabelText('Gestionar a Hugo'));

    expect(navigation.navigate).toHaveBeenCalledWith('CuidadorHome');
  });

  it('una cuenta sin nadie a cargo va derecho a vincular, sin lista vacía de por medio', async () => {
    const getLinkedPatients = { execute: jest.fn().mockResolvedValue(Ok({ patients: [] })) };

    await render(
      withProviders(<MisPacientesScreen navigation={buildNavigationMock()} route={baseRoute} />, {
        role: 'CUIDADOR',
        patientId: '',
        useCases: { getLinkedPatients: getLinkedPatients as never },
      }),
    );

    await waitFor(() => expect(screen.getByText('Vinculá a tu Adulto Mayor')).toBeTruthy());
    expect(screen.queryByText('Sumar a otra persona')).toBeNull();
  });

  it('con pacientes, sumar a otro pide el código sin perder la lista', async () => {
    const getLinkedPatients = {
      execute: jest.fn().mockResolvedValue(Ok({ patients: [paciente('p1', 'Rosa')] })),
    };
    const user = userEvent.setup();

    await render(
      withProviders(<MisPacientesScreen navigation={buildNavigationMock()} route={baseRoute} />, {
        role: 'CUIDADOR',
        patientId: '',
        useCases: { getLinkedPatients: getLinkedPatients as never },
      }),
    );

    await waitFor(() => expect(screen.getByText('Sumar a otra persona')).toBeTruthy());
    await user.press(screen.getByText('Sumar a otra persona'));

    expect(screen.getByText('Sumá a otra persona')).toBeTruthy();
    expect(screen.getByText('Rosa')).toBeTruthy();
  });

  it('nombra al paciente sin nombre en vez de mostrar una tarjeta muda', async () => {
    const getLinkedPatients = {
      execute: jest.fn().mockResolvedValue(Ok({ patients: [paciente('p1', null), paciente('p2', '   ')] })),
    };

    await render(
      withProviders(<MisPacientesScreen navigation={buildNavigationMock()} route={baseRoute} />, {
        role: 'CUIDADOR',
        patientId: '',
        useCases: { getLinkedPatients: getLinkedPatients as never },
      }),
    );

    await waitFor(() => expect(screen.getAllByText('Paciente sin nombre')).toHaveLength(2));
  });

  it('ofrece reintentar si la lista no carga, en vez de quedar en blanco', async () => {
    const getLinkedPatients = {
      execute: jest
        .fn()
        .mockResolvedValueOnce(Err(DomainErrors.repositoryFailure(new Error('sin red'))))
        .mockResolvedValue(Ok({ patients: [paciente('p1', 'Rosa')] })),
    };
    const user = userEvent.setup();

    await render(
      withProviders(<MisPacientesScreen navigation={buildNavigationMock()} route={baseRoute} />, {
        role: 'CUIDADOR',
        patientId: '',
        useCases: { getLinkedPatients: getLinkedPatients as never },
      }),
    );

    await waitFor(() => expect(screen.getByText('No pudimos cargar a quiénes cuidás.')).toBeTruthy());
    await user.press(screen.getByText('Reintentar'));

    await waitFor(() => expect(screen.getByText('Rosa')).toBeTruthy());
  });
});
