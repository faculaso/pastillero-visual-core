/**
 * Mismo patrón que `notifee-notification-scheduler.test.ts`: el factory de
 * `jest.mock` debe ser AUTOCONTENIDO (crear los `jest.fn()` adentro), porque
 * los `import` del archivo se hoistean por sobre cualquier `const` externo
 * que el factory quisiera referenciar — ver el comentario largo en aquel
 * archivo para el detalle completo de por qué.
 */
jest.mock('react-native-fs', () => ({
  __esModule: true,
  default: {
    DocumentDirectoryPath: '/data/user/0/com.pastillero/files',
    exists: jest.fn(),
    mkdir: jest.fn().mockResolvedValue(undefined),
    copyFile: jest.fn().mockResolvedValue(undefined),
    unlink: jest.fn().mockResolvedValue(undefined),
  },
}));

import RNFSDefault from 'react-native-fs';
import { RNFSLocalImageStorageService } from '../../src/infrastructure/services/image-storage/rnfs-local-image-storage.service';

interface MockRNFS {
  DocumentDirectoryPath: string;
  exists: jest.Mock;
  mkdir: jest.Mock;
  copyFile: jest.Mock;
  unlink: jest.Mock;
}

const mockRNFS = RNFSDefault as unknown as MockRNFS;

function buildIdGenerator(id = 'generated-id') {
  return { generate: jest.fn().mockReturnValue(id) };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRNFS.exists.mockResolvedValue(false);
});

describe('RNFSLocalImageStorageService', () => {
  it('crea el directorio si no existe, copia el archivo, y devuelve una URI file:// persistente', async () => {
    mockRNFS.exists.mockResolvedValueOnce(false); // el directorio no existe
    const service = new RNFSLocalImageStorageService(buildIdGenerator('img-1') as never);

    const result = await service.saveImage('file:///cache/tmp-picker/photo.jpg');

    expect(result).toEqual({
      ok: true,
      value: 'file:///data/user/0/com.pastillero/files/box-images/img-1.jpg',
    });
    expect(mockRNFS.mkdir).toHaveBeenCalledWith('/data/user/0/com.pastillero/files/box-images');
    expect(mockRNFS.copyFile).toHaveBeenCalledWith(
      '/cache/tmp-picker/photo.jpg',
      '/data/user/0/com.pastillero/files/box-images/img-1.jpg',
    );
  });

  it('NO recrea el directorio si ya existe', async () => {
    mockRNFS.exists.mockResolvedValueOnce(true); // el directorio YA existe
    const service = new RNFSLocalImageStorageService(buildIdGenerator() as never);

    await service.saveImage('file:///cache/photo.png');

    expect(mockRNFS.mkdir).not.toHaveBeenCalled();
  });

  it('conserva la extensión original del archivo fuente', async () => {
    const service = new RNFSLocalImageStorageService(buildIdGenerator('img-2') as never);
    await service.saveImage('file:///cache/photo.PNG');

    expect(mockRNFS.copyFile).toHaveBeenCalledWith(expect.any(String), expect.stringMatching(/img-2\.png$/));
  });

  it('propaga un fallo de copyFile como REPOSITORY_FAILURE', async () => {
    mockRNFS.copyFile.mockRejectedValueOnce(new Error('disk full'));
    const service = new RNFSLocalImageStorageService(buildIdGenerator() as never);

    const result = await service.saveImage('file:///cache/photo.jpg');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('REPOSITORY_FAILURE');
  });

  it('deleteImage borra el archivo si existe', async () => {
    mockRNFS.exists.mockResolvedValueOnce(true);
    const service = new RNFSLocalImageStorageService(buildIdGenerator() as never);

    const result = await service.deleteImage('file:///data/user/0/com.pastillero/files/box-images/img-1.jpg');

    expect(result).toEqual({ ok: true, value: undefined });
    expect(mockRNFS.unlink).toHaveBeenCalledWith('/data/user/0/com.pastillero/files/box-images/img-1.jpg');
  });

  it('deleteImage es idempotente: no falla ni llama unlink si el archivo ya no existe', async () => {
    mockRNFS.exists.mockResolvedValueOnce(false);
    const service = new RNFSLocalImageStorageService(buildIdGenerator() as never);

    const result = await service.deleteImage('file:///ya-no-existe.jpg');

    expect(result).toEqual({ ok: true, value: undefined });
    expect(mockRNFS.unlink).not.toHaveBeenCalled();
  });
});
