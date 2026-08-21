import type { Result } from '../../domain';
import type { DomainError } from '../../domain';

/**
 * Puerto de aplicación (no de dominio, mismo criterio que `NotificationScheduler`):
 * copiar un archivo a almacenamiento persistente es una capacidad técnica,
 * no una regla de negocio, pero el resultado (la URI persistente) SÍ viaja
 * hasta `VisualProfile.boxImageUrl` y se guarda en SQLite — por eso no es
 * un servicio puramente de presentación como `ConfirmationFeedback`.
 *
 * `saveImage` recibe la URI TEMPORAL que devuelve el image picker (caché
 * del SO, puede limpiarse en cualquier momento) y devuelve una URI
 * PERSISTENTE (directorio propio de la app) — la distinción importa: guardar
 * la URI temporal directamente en `VisualProfile` produciría un "foto rota"
 * silencioso días después, cuando el SO limpie su caché.
 */
export interface LocalImageStorageService {
  saveImage(sourceUri: string): Promise<Result<string, DomainError>>;
  /** Idempotente: no falla si el archivo ya no existe (borrado externo, doble-tap, etc.). */
  deleteImage(uri: string): Promise<Result<void, DomainError>>;
}
