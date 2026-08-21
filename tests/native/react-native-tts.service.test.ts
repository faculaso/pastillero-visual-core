/**
 * Mismo patrón que los demás tests de `tests/native/`: el factory de
 * `jest.mock` debe ser autocontenido. Acá además el mock necesita ser un
 * emisor de eventos REAL (no solo `jest.fn()`s sueltos), porque
 * `ReactNativeTtsService` envuelve la API basada en eventos de
 * `react-native-tts` en una Promise — hay que poder simular
 * `tts-finish`/`tts-cancel`/`tts-error` disparándose de verdad.
 */
jest.mock('react-native-tts', () => {
  const listeners: Record<string, Array<(event: unknown) => void>> = {};
  const mockTts = {
    getInitStatus: jest.fn().mockResolvedValue('success'),
    setDefaultLanguage: jest.fn().mockResolvedValue('success'),
    setDefaultRate: jest.fn().mockResolvedValue('success'),
    setDefaultPitch: jest.fn().mockResolvedValue('success'),
    speak: jest.fn(),
    stop: jest.fn().mockResolvedValue(true),
    addEventListener: jest.fn((type: string, handler: (event: unknown) => void) => {
      listeners[type] = listeners[type] || [];
      listeners[type]!.push(handler);
    }),
    removeEventListener: jest.fn((type: string, handler: (event: unknown) => void) => {
      listeners[type] = (listeners[type] || []).filter((h) => h !== handler);
    }),
    __emit: (type: string, event: unknown) => {
      (listeners[type] || []).forEach((h) => h(event));
    },
    __listenerCount: (type: string) => (listeners[type] || []).length,
  };
  return { __esModule: true, default: mockTts };
});

import TtsDefault from 'react-native-tts';
import { ReactNativeTtsService } from '../../src/infrastructure/services/tts/react-native-tts.service';

interface MockTts {
  getInitStatus: jest.Mock;
  setDefaultLanguage: jest.Mock;
  setDefaultRate: jest.Mock;
  setDefaultPitch: jest.Mock;
  speak: jest.Mock;
  stop: jest.Mock;
  addEventListener: jest.Mock;
  removeEventListener: jest.Mock;
  __emit: (type: string, event: unknown) => void;
  __listenerCount: (type: string) => number;
}

const mockTts = TtsDefault as unknown as MockTts;

/** Hace que `Tts.speak()` dispare el evento indicado en el próximo tick — simula el comportamiento async real del motor nativo. */
function mockSpeakResolvesWith(eventType: 'tts-finish' | 'tts-cancel' | 'tts-error', utteranceId = 'utt-1') {
  mockTts.speak.mockImplementation(() => {
    setImmediate(() => mockTts.__emit(eventType, { utteranceId }));
    return utteranceId;
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ReactNativeTtsService', () => {
  it('configura idioma/velocidad/tono pausados por default antes de hablar', async () => {
    mockSpeakResolvesWith('tts-finish');
    const service = new ReactNativeTtsService();

    await service.speak('Hola');

    expect(mockTts.setDefaultLanguage).toHaveBeenCalledWith('es-AR');
    expect(mockTts.setDefaultRate).toHaveBeenCalledWith(0.35);
    expect(mockTts.setDefaultPitch).toHaveBeenCalledWith(1.0);
  });

  it('permite overridear idioma/velocidad/tono por llamada', async () => {
    mockSpeakResolvesWith('tts-finish');
    const service = new ReactNativeTtsService();

    await service.speak('Hola', { language: 'es-ES', rate: 0.5, pitch: 1.2 });

    expect(mockTts.setDefaultLanguage).toHaveBeenCalledWith('es-ES');
    expect(mockTts.setDefaultRate).toHaveBeenCalledWith(0.5);
    expect(mockTts.setDefaultPitch).toHaveBeenCalledWith(1.2);
  });

  it('resuelve Ok recién cuando llega tts-finish para ESA utterance', async () => {
    mockSpeakResolvesWith('tts-finish', 'utt-1');
    const service = new ReactNativeTtsService();

    const result = await service.speak('Hola');
    expect(result).toEqual({ ok: true, value: undefined });
  });

  it('ignora eventos de otras utterances antes de resolver la propia', async () => {
    mockTts.speak.mockImplementation(() => {
      setImmediate(() => {
        mockTts.__emit('tts-finish', { utteranceId: 'otra-utterance' });
        mockTts.__emit('tts-finish', { utteranceId: 'utt-1' });
      });
      return 'utt-1';
    });
    const service = new ReactNativeTtsService();

    const result = await service.speak('Hola');
    expect(result).toEqual({ ok: true, value: undefined });
  });

  it('tts-cancel resuelve Ok (cancelar no es un error)', async () => {
    mockSpeakResolvesWith('tts-cancel');
    const service = new ReactNativeTtsService();

    const result = await service.speak('Hola');
    expect(result).toEqual({ ok: true, value: undefined });
  });

  it('tts-error se propaga como REPOSITORY_FAILURE', async () => {
    mockSpeakResolvesWith('tts-error');
    const service = new ReactNativeTtsService();

    const result = await service.speak('Hola');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('REPOSITORY_FAILURE');
  });

  it('limpia los listeners tras resolver (no deja handlers colgados)', async () => {
    mockSpeakResolvesWith('tts-finish');
    const service = new ReactNativeTtsService();

    await service.speak('Hola');

    expect(mockTts.__listenerCount('tts-finish')).toBe(0);
    expect(mockTts.__listenerCount('tts-cancel')).toBe(0);
    expect(mockTts.__listenerCount('tts-error')).toBe(0);
  });

  it('getInitStatus se llama una sola vez aunque se hable varias veces', async () => {
    mockSpeakResolvesWith('tts-finish');
    const service = new ReactNativeTtsService();

    await service.speak('Uno');
    await service.speak('Dos');

    expect(mockTts.getInitStatus).toHaveBeenCalledTimes(1);
  });

  it('stop() llama a Tts.stop()', async () => {
    const service = new ReactNativeTtsService();
    const result = await service.stop();

    expect(result).toEqual({ ok: true, value: undefined });
    expect(mockTts.stop).toHaveBeenCalledTimes(1);
  });

  it('propaga un fallo de configuración (ej. setDefaultRate) como REPOSITORY_FAILURE', async () => {
    mockTts.setDefaultRate.mockRejectedValueOnce(new Error('bad_rate'));
    const service = new ReactNativeTtsService();

    const result = await service.speak('Hola');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('REPOSITORY_FAILURE');
  });
});
