import React from 'react';
import { render, screen, waitFor, userEvent } from '@testing-library/react-native';

/**
 * Mismo motivo que en RegisterTreatmentScreen.test.tsx: react-native-image-picker
 * distribuye TS sin compilar, Jest no puede parsearlo sin mock.
 */
jest.mock('react-native-image-picker', () => ({
  __esModule: true,
  launchCamera: jest.fn(),
  launchImageLibrary: jest.fn(),
}));

import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { Ok, Err, DomainErrors } from '../../src/domain';
import { BoxPhotoCaptureField } from '../../src/presentation/screens/register-treatment/components/BoxPhotoCaptureField';
import { withProviders } from './test-utils';

const mockLaunchCamera = launchCamera as jest.Mock;
const mockLaunchImageLibrary = launchImageLibrary as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('BoxPhotoCaptureField', () => {
  it('al sacar una foto con la cámara, la copia a almacenamiento persistente y notifica la nueva URI', async () => {
    mockLaunchCamera.mockResolvedValue({
      didCancel: false,
      assets: [{ uri: 'file:///cache/tmp-picker/photo.jpg' }],
    });
    const localImageStorage = { saveImage: jest.fn().mockResolvedValue(Ok('file:///data/app/box-images/img-1.jpg')) };
    const onImageChange = jest.fn();
    const user = userEvent.setup();

    await render(
      withProviders(<BoxPhotoCaptureField imageUri="" onImageChange={onImageChange} />, {
        useCases: { localImageStorage: localImageStorage as never },
      }),
    );

    await user.press(screen.getByText('Sacar foto'));

    expect(mockLaunchCamera).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(localImageStorage.saveImage).toHaveBeenCalledWith('file:///cache/tmp-picker/photo.jpg'),
    );
    await waitFor(() => expect(onImageChange).toHaveBeenCalledWith('file:///data/app/box-images/img-1.jpg'));
  });

  it('al elegir de la galería, usa launchImageLibrary en vez de la cámara', async () => {
    mockLaunchImageLibrary.mockResolvedValue({ didCancel: false, assets: [{ uri: 'file:///cache/gallery.jpg' }] });
    const localImageStorage = { saveImage: jest.fn().mockResolvedValue(Ok('file:///persisted/gallery.jpg')) };
    const onImageChange = jest.fn();
    const user = userEvent.setup();

    await render(
      withProviders(<BoxPhotoCaptureField imageUri="" onImageChange={onImageChange} />, {
        useCases: { localImageStorage: localImageStorage as never },
      }),
    );

    await user.press(screen.getByText('Elegir de galería'));

    expect(mockLaunchImageLibrary).toHaveBeenCalledTimes(1);
    expect(mockLaunchCamera).not.toHaveBeenCalled();
    await waitFor(() => expect(onImageChange).toHaveBeenCalledWith('file:///persisted/gallery.jpg'));
  });

  it('si el usuario cancela el picker, no llama a onImageChange ni muestra error', async () => {
    mockLaunchCamera.mockResolvedValue({ didCancel: true });
    const localImageStorage = { saveImage: jest.fn() };
    const onImageChange = jest.fn();
    const user = userEvent.setup();

    await render(
      withProviders(<BoxPhotoCaptureField imageUri="" onImageChange={onImageChange} />, {
        useCases: { localImageStorage: localImageStorage as never },
      }),
    );

    await user.press(screen.getByText('Sacar foto'));

    expect(localImageStorage.saveImage).not.toHaveBeenCalled();
    expect(onImageChange).not.toHaveBeenCalled();
    expect(screen.queryByText('No pudimos guardar la foto. Intentá de nuevo.')).toBeNull();
  });

  it('si el picker devuelve error (ej. permiso denegado), muestra el mensaje de error', async () => {
    mockLaunchCamera.mockResolvedValue({ didCancel: false, errorCode: 'permission' });
    const localImageStorage = { saveImage: jest.fn() };
    const user = userEvent.setup();

    await render(
      withProviders(<BoxPhotoCaptureField imageUri="" onImageChange={jest.fn()} />, {
        useCases: { localImageStorage: localImageStorage as never },
      }),
    );

    await user.press(screen.getByText('Sacar foto'));

    await waitFor(() => expect(screen.getByText('No pudimos guardar la foto. Intentá de nuevo.')).toBeTruthy());
    expect(localImageStorage.saveImage).not.toHaveBeenCalled();
  });

  it('si falla el guardado local, muestra error y NO actualiza la URI del formulario', async () => {
    mockLaunchCamera.mockResolvedValue({ didCancel: false, assets: [{ uri: 'file:///cache/photo.jpg' }] });
    const localImageStorage = { saveImage: jest.fn().mockResolvedValue(Err(DomainErrors.repositoryFailure(new Error('disk full')))) };
    const onImageChange = jest.fn();
    const user = userEvent.setup();

    await render(
      withProviders(<BoxPhotoCaptureField imageUri="" onImageChange={onImageChange} />, {
        useCases: { localImageStorage: localImageStorage as never },
      }),
    );

    await user.press(screen.getByText('Sacar foto'));

    await waitFor(() => expect(screen.getByText('No pudimos guardar la foto. Intentá de nuevo.')).toBeTruthy());
    expect(onImageChange).not.toHaveBeenCalled();
  });

  it('muestra la preview y el botón "Quitar foto" cuando ya hay una imagen guardada', async () => {
    const onImageChange = jest.fn();
    await render(
      withProviders(<BoxPhotoCaptureField imageUri="file:///persisted/photo.jpg" onImageChange={onImageChange} />),
    );

    expect(screen.getByLabelText('Foto de la caja capturada')).toBeTruthy();
    expect(screen.getByText('Quitar foto')).toBeTruthy();
  });

  it('"Quitar foto" limpia la URI del formulario (pasa string vacío)', async () => {
    const onImageChange = jest.fn();
    const user = userEvent.setup();
    await render(
      withProviders(<BoxPhotoCaptureField imageUri="file:///persisted/photo.jpg" onImageChange={onImageChange} />),
    );

    await user.press(screen.getByText('Quitar foto'));
    expect(onImageChange).toHaveBeenCalledWith('');
  });
});
