import type { Result } from '../../domain';
import type { DomainError } from '../../domain';

export interface VoiceGuidanceOptions {
  /**
   * Velocidad de habla. Escala 0.0–1.0 según el driver (ver
   * `ReactNativeTtsService` para el mapeo real). Si se omite, el servicio
   * usa un default ya pensado para adultos mayores (más lento que el
   * default del motor TTS del SO) — no hace falta pasarlo en el caller
   * salvo que se quiera un ritmo distinto puntualmente.
   */
  readonly rate?: number;
  readonly pitch?: number;
  /** BCP-47, ej. 'es-AR', 'es-ES'. Default: español configurado en el servicio. */
  readonly language?: string;
}

/**
 * Puerto de aplicación (mismo criterio que `NotificationScheduler`/
 * `LocalImageStorageService`): capacidad técnica del dispositivo, sin
 * invariante de dominio que validar, pero con relevancia de negocio
 * suficiente (accesibilidad auditiva para CU-02) como para no ser un
 * detalle puramente de presentación.
 *
 * `speak` resuelve recién cuando el habla TERMINA (no cuando arranca) —
 * importa para que la UI pueda mostrar un estado "hablando..." preciso en
 * vez de uno optimista.
 */
export interface VoiceGuidancePort {
  speak(text: string, options?: VoiceGuidanceOptions): Promise<Result<void, DomainError>>;
  stop(): Promise<Result<void, DomainError>>;
}
