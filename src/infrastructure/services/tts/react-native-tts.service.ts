import Tts, { type TtsEvent } from 'react-native-tts';
import { Ok, Err, type Result, DomainErrors, type DomainError } from '../../../domain';
import type { VoiceGuidancePort, VoiceGuidanceOptions } from '../../../application';

/** Español rioplatense por default — configurable por llamada vía `options.language` (ej. 'es-ES'). */
const DEFAULT_LANGUAGE = 'es-AR';

/**
 * Escala 0.0–1.0 de `react-native-tts`. El default del motor nativo suele
 * rondar 0.5; para adultos mayores (CU-02, mismo perfil de usuario que
 * justifica los touch targets grandes del design system) se usa un ritmo
 * notablemente más lento — dar tiempo a procesar cada palabra importa más
 * que sonar "natural".
 */
const ELDERLY_RATE = 0.35;
const ELDERLY_PITCH = 1.0; // tono neutro: no hace falta más grave/agudo, solo más lento

/**
 * Implementación real de `VoiceGuidancePort` sobre `react-native-tts`.
 *
 * PIEZA NO OBVIA: `Tts.speak()` NO devuelve una Promise que se resuelva al
 * terminar de hablar — devuelve SINCRÓNICAMENTE un id de utterance, y el
 * final se notifica vía eventos (`tts-finish`/`tts-error`/`tts-cancel`).
 * `speakAndAwaitCompletion` envuelve eso en una Promise real, matcheando
 * el evento contra el id de ESTA llamada puntual (necesario para no
 * resolver la promesa equivocada si en algún momento hay más de un
 * `speak()` superpuesto).
 */
export class ReactNativeTtsService implements VoiceGuidancePort {
  private initPromise: Promise<void> | null = null;

  async speak(text: string, options: VoiceGuidanceOptions = {}): Promise<Result<void, DomainError>> {
    try {
      await this.ensureInitialized();
      await Tts.setDefaultLanguage(options.language ?? DEFAULT_LANGUAGE);
      await Tts.setDefaultRate(options.rate ?? ELDERLY_RATE);
      await Tts.setDefaultPitch(options.pitch ?? ELDERLY_PITCH);
      await this.speakAndAwaitCompletion(text);
      return Ok(undefined);
    } catch (cause) {
      return Err(DomainErrors.repositoryFailure(cause));
    }
  }

  async stop(): Promise<Result<void, DomainError>> {
    try {
      await Tts.stop();
      return Ok(undefined);
    } catch (cause) {
      return Err(DomainErrors.repositoryFailure(cause));
    }
  }

  /** `getInitStatus()` es idempotente pero no gratis (bridge nativo) — se cachea para no repetirla en cada `speak()`. */
  private ensureInitialized(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = Tts.getInitStatus().then(() => undefined);
    }
    return this.initPromise;
  }

  private speakAndAwaitCompletion(text: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const utteranceId = Tts.speak(text);

      const onFinish = (event: TtsEvent<'tts-finish'>): void => {
        if (event.utteranceId !== utteranceId) return;
        cleanup();
        resolve();
      };

      const onCancel = (event: TtsEvent<'tts-cancel'>): void => {
        if (event.utteranceId !== utteranceId) return;
        cleanup();
        // Cancelado explícitamente (ej. el usuario tocó "Detener"): no es
        // un fallo del servicio, se resuelve normalmente.
        resolve();
      };

      const onError = (event: TtsEvent<'tts-error'>): void => {
        if (event.utteranceId !== utteranceId) return;
        cleanup();
        reject(new Error(`TTS error para utterance ${String(utteranceId)}`));
      };

      function cleanup(): void {
        Tts.removeEventListener('tts-finish', onFinish);
        Tts.removeEventListener('tts-cancel', onCancel);
        Tts.removeEventListener('tts-error', onError);
      }

      Tts.addEventListener('tts-finish', onFinish);
      Tts.addEventListener('tts-cancel', onCancel);
      Tts.addEventListener('tts-error', onError);
    });
  }
}
