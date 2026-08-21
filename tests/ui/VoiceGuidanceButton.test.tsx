import React from 'react';
import { render, screen, waitFor, userEvent } from '@testing-library/react-native';
import { Ok, Err, DomainErrors } from '../../src/domain';
import { VoiceGuidanceButton } from '../../src/presentation/screens/pastillero-virtual/components/VoiceGuidanceButton';
import { withProviders } from './test-utils';

describe('VoiceGuidanceButton', () => {
  it('al presionar "Escuchar indicaciones", llama a speak() con el texto provisto', async () => {
    let resolveSpeak: (value: ReturnType<typeof Ok>) => void;
    const speakPromise = new Promise((resolve) => {
      resolveSpeak = resolve;
    });
    const voiceGuidance = { speak: jest.fn().mockReturnValue(speakPromise), stop: jest.fn() };
    const user = userEvent.setup();

    await render(
      withProviders(<VoiceGuidanceButton text="Es hora de tomar Paracetamol." />, {
        useCases: { voiceGuidance: voiceGuidance as never },
      }),
    );

    await user.press(screen.getByText('Escuchar indicaciones'));

    expect(voiceGuidance.speak).toHaveBeenCalledWith('Es hora de tomar Paracetamol.');
    await waitFor(() => expect(screen.getByText('Detener')).toBeTruthy());

    resolveSpeak!(Ok(undefined));
    await waitFor(() => expect(screen.getByText('Escuchar indicaciones')).toBeTruthy());
  });

  it('mientras está hablando, el botón dice "Detener" y presionarlo llama a stop()', async () => {
    const speakPromise = new Promise(() => {}); // nunca resuelve durante el test
    const voiceGuidance = { speak: jest.fn().mockReturnValue(speakPromise), stop: jest.fn().mockResolvedValue(Ok(undefined)) };
    const user = userEvent.setup();

    await render(
      withProviders(<VoiceGuidanceButton text="texto" />, { useCases: { voiceGuidance: voiceGuidance as never } }),
    );

    await user.press(screen.getByText('Escuchar indicaciones'));
    await waitFor(() => expect(screen.getByText('Detener')).toBeTruthy());

    await user.press(screen.getByText('Detener'));

    expect(voiceGuidance.stop).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByText('Escuchar indicaciones')).toBeTruthy());
  });

  it('si speak() falla, vuelve a "Escuchar indicaciones" y muestra un mensaje de error', async () => {
    const voiceGuidance = {
      speak: jest.fn().mockResolvedValue(Err(DomainErrors.repositoryFailure(new Error('tts down')))),
      stop: jest.fn(),
    };
    const user = userEvent.setup();

    await render(
      withProviders(<VoiceGuidanceButton text="texto" />, { useCases: { voiceGuidance: voiceGuidance as never } }),
    );

    await user.press(screen.getByText('Escuchar indicaciones'));

    await waitFor(() => expect(screen.getByText('No pudimos reproducir el audio. Intentá de nuevo.')).toBeTruthy());
    expect(screen.getByText('Escuchar indicaciones')).toBeTruthy();
  });

  it('expone accessibilityHint describiendo qué hace el botón', async () => {
    const voiceGuidance = { speak: jest.fn(), stop: jest.fn() };
    await render(
      withProviders(<VoiceGuidanceButton text="texto" />, { useCases: { voiceGuidance: voiceGuidance as never } }),
    );

    expect(
      screen.getByA11yHint('Lee en voz alta el nombre del medicamento, la dosis y cómo tomarlo'),
    ).toBeTruthy();
  });
});
