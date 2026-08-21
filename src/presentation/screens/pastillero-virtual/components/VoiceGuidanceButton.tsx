import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useUseCases } from '../../../providers/UseCasesProvider';
import { AccessibleButton } from '../../../design-system/AccessibleButton';
import { AccessibleText } from '../../../design-system/AccessibleText';
import { colors, spacing } from '../../../design-system/tokens';

export interface VoiceGuidanceButtonProps {
  /** Texto ya compuesto a leer — ver `buildDoseVoiceMessage`. */
  readonly text: string;
}

type SpeechStatus = 'idle' | 'speaking' | 'error';

/**
 * CU-02: accesibilidad auditiva. El botón alterna entre "Escuchar
 * indicaciones" y "Detener" según el estado REAL de habla — esto funciona
 * porque `VoiceGuidancePort.speak()` resuelve recién cuando el TTS termina
 * (no cuando arranca), así que `status === 'speaking'` mientras la promesa
 * está pendiente refleja lo que está pasando de verdad, no una animación
 * optimista desconectada del audio real.
 */
export function VoiceGuidanceButton({ text }: VoiceGuidanceButtonProps): React.JSX.Element {
  const { voiceGuidance } = useUseCases();
  const [status, setStatus] = useState<SpeechStatus>('idle');

  async function handlePress(): Promise<void> {
    if (status === 'speaking') {
      await voiceGuidance.stop();
      setStatus('idle');
      return;
    }

    setStatus('speaking');
    const result = await voiceGuidance.speak(text);
    // Si en el medio el usuario ya tocó "Detener", `stop()` ya puso status
    // en 'idle' — no lo pisamos de vuelta a 'idle' con esto (sería un no-op
    // igual, pero evita una re-render redundante).
    setStatus((current) => (current === 'speaking' ? (result.ok ? 'idle' : 'error') : current));
  }

  return (
    <View style={styles.container}>
      <AccessibleButton
        label={status === 'speaking' ? 'Detener' : 'Escuchar indicaciones'}
        variant="secondary"
        onPress={handlePress}
        accessibilityHint="Lee en voz alta el nombre del medicamento, la dosis y cómo tomarlo"
      />
      {status === 'error' ? (
        <AccessibleText variant="small" color={colors.critical}>
          No pudimos reproducir el audio. Intentá de nuevo.
        </AccessibleText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
});
