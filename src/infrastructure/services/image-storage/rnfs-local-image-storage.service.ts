import RNFS from 'react-native-fs';
import { Ok, Err, type Result, DomainErrors, type DomainError } from '../../../domain';
import type { LocalImageStorageService } from '../../../application';
import type { IdGenerator } from '../../../application';
import { inferImageExtension, stripFileUriScheme } from './image-path.utils';

const IMAGES_SUBDIRECTORY = 'box-images';

/**
 * Implementación real de `LocalImageStorageService` sobre `react-native-fs`.
 *
 * Usa `RNFS.DocumentDirectoryPath` (no `CachesDirectoryPath`): el directorio
 * de documentos es el que el SO NO limpia automáticamente bajo presión de
 * almacenamiento — `Caches` sí, y ahí es exactamente donde vive la URI
 * temporal que entrega el image picker antes de copiarla acá.
 *
 * LÍMITE CONOCIDO: `RNFS.copyFile` espera un path de archivo; algunas URIs
 * `content://` de Android (poco común con `react-native-image-picker` en
 * su modo default, que ya copia a un archivo temporal `file://` antes de
 * devolver la respuesta, pero puede ocurrir con ciertas configuraciones o
 * providers de galería de terceros) pueden fallar la copia. Ese caso se
 * propaga como `Err(REPOSITORY_FAILURE)` — no se intenta un fallback
 * automático de lectura vía content resolver, agregarlo es la extensión
 * natural si en producción aparece este caso.
 */
export class RNFSLocalImageStorageService implements LocalImageStorageService {
  constructor(private readonly idGenerator: IdGenerator) {}

  async saveImage(sourceUri: string): Promise<Result<string, DomainError>> {
    try {
      const directory = `${RNFS.DocumentDirectoryPath}/${IMAGES_SUBDIRECTORY}`;
      await this.ensureDirectoryExists(directory);

      const fileName = `${this.idGenerator.generate()}.${inferImageExtension(sourceUri)}`;
      const destinationPath = `${directory}/${fileName}`;

      await RNFS.copyFile(stripFileUriScheme(sourceUri), destinationPath);

      return Ok(`file://${destinationPath}`);
    } catch (cause) {
      return Err(DomainErrors.repositoryFailure(cause));
    }
  }

  async deleteImage(uri: string): Promise<Result<void, DomainError>> {
    try {
      const path = stripFileUriScheme(uri);
      const fileExists = await RNFS.exists(path);
      if (fileExists) {
        await RNFS.unlink(path);
      }
      return Ok(undefined);
    } catch (cause) {
      return Err(DomainErrors.repositoryFailure(cause));
    }
  }

  private async ensureDirectoryExists(directory: string): Promise<void> {
    const exists = await RNFS.exists(directory);
    if (!exists) {
      await RNFS.mkdir(directory);
    }
  }
}
