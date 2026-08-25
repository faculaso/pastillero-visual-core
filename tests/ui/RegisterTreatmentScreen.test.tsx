import React from 'react';
import { render, screen, waitFor, userEvent } from '@testing-library/react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

// react-native-image-picker distribuye su código fuente en TS sin compilar
// (no está en el allowlist de transformIgnorePatterns porque no es un
// problema de Flow como react-native — es simplemente TS crudo que Jest no
// puede parsear). Se mockea acá porque `RegisterTreatmentScreen` importa
// (transitivamente, vía `BoxPhotoCaptureField`) este paquete.
jest.mock('react-native-image-picker', () => ({
  __esModule: true,
  launchCamera: jest.fn().mockResolvedValue({ didCancel: true }),
  launchImageLibrary: jest.fn().mockResolvedValue({ didCancel: true }),
}));

import { RegisterTreatmentScreen } from '../../src/presentation/screens/register-treatment/RegisterTreatmentScreen';
import type { CuidadorStackParamList } from '../../src/presentation/navigation/types';
import { Ok, Err, DomainErrors } from '../../src/domain';
import { buildMedication, buildTreatment } from '../support/fixtures';
import { withProviders } from './test-utils';

type Props = NativeStackScreenProps<CuidadorStackParamList, 'RegisterTreatment'>;

function buildNavigationMock(): Props['navigation'] {
  return {
    replace: jest.fn(),
    navigate: jest.fn(),
    goBack: jest.fn(),
  } as unknown as Props['navigation'];
}

const baseRoute = { key: 'register-1', name: 'RegisterTreatment' as const, params: undefined };

describe('RegisterTreatmentScreen', () => {
  it('busca, selecciona un medicamento, completa el formulario y guarda el tratamiento', async () => {
    const medication = buildMedication({ id: 'med-1', name: 'Paracetamol 500mg' });
    const treatment = buildTreatment({ id: 'treatment-1', medication });

    const searchMedicationCatalog = { execute: jest.fn().mockResolvedValue(Ok({ medications: [medication] })) };
    const registerTreatment = {
      execute: jest.fn().mockResolvedValue(Ok({ treatment, generatedDoses: [], notificationWarnings: [] })),
    };
    const navigation = buildNavigationMock();
    const user = userEvent.setup();

    await render(
      withProviders(<RegisterTreatmentScreen navigation={navigation} route={baseRoute} />, {
        role: 'CUIDADOR',
        useCases: {
          searchMedicationCatalog: searchMedicationCatalog as never,
          registerTreatment: registerTreatment as never,
        },
      }),
    );

    await user.type(screen.getByLabelText('Buscar medicamento por nombre o código de barras'), 'paracet');
    await user.press(screen.getByText('Buscar'));

    await waitFor(() => expect(screen.getByText('Paracetamol 500mg')).toBeTruthy());
    await user.press(screen.getByText('Paracetamol 500mg'));

    await waitFor(() => expect(screen.getByText('Guardar tratamiento')).toBeTruthy());
    await user.press(screen.getByText('Guardar tratamiento'));

    await waitFor(() => expect(registerTreatment.execute).toHaveBeenCalled());
    const callArg = registerTreatment.execute.mock.calls[0][0];
    expect(callArg.medicationId).toBe('med-1');
    expect(callArg.dosageScheme.frequency).toBe('DAILY');
    expect(callArg.dosageScheme.timesOfDay).toEqual([{ hour: 8, minute: 0 }]);
    expect(callArg.initialStock).toEqual({ currentQuantity: 30, dailyConsumption: 1, unit: 'UNIT' });

    await waitFor(() =>
      expect(navigation.replace).toHaveBeenCalledWith('AdherenceDashboard', { treatmentId: 'treatment-1' }),
    );
  });

  it('destildar "Todos los días" no bloquea el guardado (todavía no hay UI para elegir días sueltos, así que igual guarda DAILY)', async () => {
    const medication = buildMedication({ id: 'med-1', name: 'Paracetamol 500mg' });
    const treatment = buildTreatment({ id: 'treatment-1', medication });
    const searchMedicationCatalog = { execute: jest.fn().mockResolvedValue(Ok({ medications: [medication] })) };
    const registerTreatment = {
      execute: jest.fn().mockResolvedValue(Ok({ treatment, generatedDoses: [], notificationWarnings: [] })),
    };
    const navigation = buildNavigationMock();
    const user = userEvent.setup();

    await render(
      withProviders(<RegisterTreatmentScreen navigation={navigation} route={baseRoute} />, {
        role: 'CUIDADOR',
        useCases: {
          searchMedicationCatalog: searchMedicationCatalog as never,
          registerTreatment: registerTreatment as never,
        },
      }),
    );

    await user.type(screen.getByLabelText('Buscar medicamento por nombre o código de barras'), 'paracet');
    await user.press(screen.getByText('Buscar'));
    await waitFor(() => expect(screen.getByText('Paracetamol 500mg')).toBeTruthy());
    await user.press(screen.getByText('Paracetamol 500mg'));

    await waitFor(() => expect(screen.getByLabelText('Todos los días')).toBeTruthy());
    await user.press(screen.getByLabelText('Todos los días'));
    await user.press(screen.getByText('Guardar tratamiento'));

    await waitFor(() => expect(registerTreatment.execute).toHaveBeenCalled());
    const callArg = registerTreatment.execute.mock.calls[0][0];
    expect(callArg.dosageScheme.frequency).toBe('DAILY');
  });

  it('prefila la hora sugerida cuando se llega desde un casillero de la grilla semanal', async () => {
    const medication = buildMedication({ id: 'med-1', name: 'Paracetamol 500mg' });
    const treatment = buildTreatment({ id: 'treatment-1', medication });
    const routeWithHour = { key: 'register-2', name: 'RegisterTreatment' as const, params: { suggestedHour: 21 } };

    const searchMedicationCatalog = { execute: jest.fn().mockResolvedValue(Ok({ medications: [medication] })) };
    const registerTreatment = {
      execute: jest.fn().mockResolvedValue(Ok({ treatment, generatedDoses: [], notificationWarnings: [] })),
    };
    const navigation = buildNavigationMock();
    const user = userEvent.setup();

    await render(
      withProviders(<RegisterTreatmentScreen navigation={navigation} route={routeWithHour} />, {
        role: 'CUIDADOR',
        useCases: {
          searchMedicationCatalog: searchMedicationCatalog as never,
          registerTreatment: registerTreatment as never,
        },
      }),
    );

    await user.type(screen.getByLabelText('Buscar medicamento por nombre o código de barras'), 'paracet');
    await user.press(screen.getByText('Buscar'));
    await waitFor(() => expect(screen.getByText('Paracetamol 500mg')).toBeTruthy());
    await user.press(screen.getByText('Paracetamol 500mg'));

    await waitFor(() => expect(screen.getByText('Guardar tratamiento')).toBeTruthy());
    await user.press(screen.getByText('Guardar tratamiento'));

    await waitFor(() => expect(registerTreatment.execute).toHaveBeenCalled());
    const callArg = registerTreatment.execute.mock.calls[0][0];
    expect(callArg.dosageScheme.timesOfDay).toEqual([{ hour: 21, minute: 0 }]);
  });

  it('muestra un error legible si el registro falla', async () => {
    const medication = buildMedication({ id: 'med-1', name: 'Ibuprofeno' });
    const searchMedicationCatalog = { execute: jest.fn().mockResolvedValue(Ok({ medications: [medication] })) };
    const registerTreatment = { execute: jest.fn().mockResolvedValue(Err(DomainErrors.medicationNotFound('med-1'))) };
    const navigation = buildNavigationMock();
    const user = userEvent.setup();

    await render(
      withProviders(<RegisterTreatmentScreen navigation={navigation} route={baseRoute} />, {
        role: 'CUIDADOR',
        useCases: {
          searchMedicationCatalog: searchMedicationCatalog as never,
          registerTreatment: registerTreatment as never,
        },
      }),
    );

    await user.type(screen.getByLabelText('Buscar medicamento por nombre o código de barras'), 'ibu');
    await user.press(screen.getByText('Buscar'));
    await waitFor(() => expect(screen.getByText('Ibuprofeno')).toBeTruthy());
    await user.press(screen.getByText('Ibuprofeno'));

    await waitFor(() => expect(screen.getByText('Guardar tratamiento')).toBeTruthy());
    await user.press(screen.getByText('Guardar tratamiento'));

    await waitFor(() =>
      expect(screen.getByText('El medicamento seleccionado ya no está disponible. Buscalo de nuevo.')).toBeTruthy(),
    );
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it('el botón Guardar tratamiento no aparece hasta seleccionar un medicamento', async () => {
    const navigation = buildNavigationMock();
    const searchMedicationCatalog = { execute: jest.fn().mockResolvedValue(Ok({ medications: [] })) };

    await render(
      withProviders(<RegisterTreatmentScreen navigation={navigation} route={baseRoute} />, {
        role: 'CUIDADOR',
        useCases: { searchMedicationCatalog: searchMedicationCatalog as never },
      }),
    );

    expect(screen.queryByText('Guardar tratamiento')).toBeNull();
  });

  it('al seleccionar el medicamento, pide una sugerencia y prefila stock inicial', async () => {
    const medication = buildMedication({ id: 'med-1', name: 'Actron' });
    const searchMedicationCatalog = { execute: jest.fn().mockResolvedValue(Ok({ medications: [medication] })) };
    const suggestVisualProfile = {
      execute: jest.fn().mockResolvedValue(
        Ok({
          suggestion: {
            shape: 'CAPSULE',
            slotLabel: '400 MG',
            suggestedStock: { quantity: 20, unit: 'UNIT' },
          },
        }),
      ),
    };
    const registerTreatment = {
      execute: jest.fn().mockResolvedValue(
        Ok({ treatment: buildTreatment({ id: 'treatment-1', medication }), generatedDoses: [], notificationWarnings: [] }),
      ),
    };
    const navigation = buildNavigationMock();
    const user = userEvent.setup();

    await render(
      withProviders(<RegisterTreatmentScreen navigation={navigation} route={baseRoute} />, {
        role: 'CUIDADOR',
        useCases: {
          searchMedicationCatalog: searchMedicationCatalog as never,
          suggestVisualProfile: suggestVisualProfile as never,
          registerTreatment: registerTreatment as never,
        },
      }),
    );

    await user.type(screen.getByLabelText('Buscar medicamento por nombre o código de barras'), 'actron');
    await user.press(screen.getByText('Buscar'));
    await waitFor(() => expect(screen.getByText('Actron')).toBeTruthy());
    await user.press(screen.getByText('Actron'));

    await waitFor(() => expect(suggestVisualProfile.execute).toHaveBeenCalledWith({ medicationId: 'med-1' }));
    await waitFor(() => expect(screen.getByText('Guardar tratamiento')).toBeTruthy());

    await user.press(screen.getByText('Guardar tratamiento'));
    await waitFor(() => expect(registerTreatment.execute).toHaveBeenCalled());

    const callArg = registerTreatment.execute.mock.calls[0][0];
    expect(callArg.visualProfile.shape).toBe('CAPSULE');
    expect(callArg.visualProfile.slotLabel).toBe('400 MG');
    expect(callArg.initialStock.currentQuantity).toBe(20);
  });

  it('si el Cuidador todavía no tiene paciente vinculado, muestra el prompt de vinculación en vez del formulario', async () => {
    const navigation = buildNavigationMock();
    const searchMedicationCatalog = { execute: jest.fn() };

    await render(
      withProviders(<RegisterTreatmentScreen navigation={navigation} route={baseRoute} />, {
        role: 'CUIDADOR',
        patientId: '',
        useCases: { searchMedicationCatalog: searchMedicationCatalog as never },
      }),
    );

    expect(screen.getByText('Vinculá a tu Adulto Mayor')).toBeTruthy();
    expect(screen.queryByLabelText('Buscar medicamento por nombre o código de barras')).toBeNull();
    expect(searchMedicationCatalog.execute).not.toHaveBeenCalled();
  });

  it('al vincular exitosamente desde el prompt, pasa a mostrar el formulario de alta', async () => {
    const navigation = buildNavigationMock();
    const searchMedicationCatalog = { execute: jest.fn().mockResolvedValue(Ok({ medications: [] })) };
    const redeemInviteCode = { execute: jest.fn().mockResolvedValue(Ok({ link: {} })) };
    const getLinkedPatient = { execute: jest.fn().mockResolvedValue(Ok({ patientId: 'patient-recien-vinculado' })) };
    const user = userEvent.setup();

    await render(
      withProviders(<RegisterTreatmentScreen navigation={navigation} route={baseRoute} />, {
        role: 'CUIDADOR',
        patientId: '',
        useCases: {
          searchMedicationCatalog: searchMedicationCatalog as never,
          redeemInviteCode: redeemInviteCode as never,
          getLinkedPatient: getLinkedPatient as never,
        },
      }),
    );

    await user.type(screen.getByLabelText('Código de invitación'), '7f2k9m');
    await user.press(screen.getByText('Vincular'));

    await waitFor(() =>
      expect(redeemInviteCode.execute).toHaveBeenCalledWith({
        caregiverId: 'test-caregiver-1',
        inviteCode: '7F2K9M',
      }),
    );
    await waitFor(() =>
      expect(screen.getByLabelText('Buscar medicamento por nombre o código de barras')).toBeTruthy(),
    );
  });
});
