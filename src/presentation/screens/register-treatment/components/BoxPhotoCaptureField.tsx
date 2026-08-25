import React, { useState } from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { launchCamera, launchImageLibrary, type Asset } from 'react-native-image-picker';
import { useUseCases } from '../../../providers/UseCasesProvider';
import { AccessibleText } from '../../../design-system/AccessibleText';
import { AccessibleButton } from '../../../design-system/AccessibleButton';
import { colors, radii, spacing, shadows } from '../../../design-system/tokens';

export interface BoxPhotoCaptureFieldProps {
  /** URI persistente ya guardada (vacío si todavía no hay foto). */
  readonly imageUri: string;
  readonly onImageChange: (uri: string) => void;
}

type CaptureStatus = 'idle' | 'saving' | 'error';

const PICKER_OPTIONS = { mediaType: 'photo' as const, quality: 0.8 as const };

/**
 * CU-01 pasos 6-7 / RF-02: captura real de la caja del medicamento.
 *
 * Flujo: el picker devuelve una URI TEMPORAL (caché del SO, se puede
 * limpiar en cualquier momento) -> `localImageStorage.saveImage()` la
 * copia a almacenamiento persistente -> recién ESE resultado se guarda en
 * el formulario. Si la copia falla, no se actualiza `boxImageUrl` — mejor
 * mantener el estado anterior que guardar una URI que va a dejar de
 * existir.
 */
export function BoxPhotoCaptureField({ imageUri, onImageChange }: BoxPhotoCaptureFieldProps): React.JSX.Element {
  const { localImageStorage } = useUseCases();
  const [status, setStatus] = useState<CaptureStatus>('idle');

  async function handlePick(source: 'camera' | 'library'): Promise<void> {
    setStatus('saving');

    const response =
      source === 'camera' ? await launchCamera(PICKER_OPTIONS) : await launchImageLibrary(PICKER_OPTIONS);

    if (response.didCancel) {
      setStatus('idle');
      return;
    }

    const asset: Asset | undefined = response.assets?.[0];
    if (response.errorCode || !asset?.uri) {
      setStatus('error');
      return;
    }

    const result = await localImageStorage.saveImage(asset.uri);
    if (!result.ok) {
      setStatus('error');
      return;
    }

    onImageChange(result.value);
    setStatus('idle');
  }

  function handleRemove(): void {
    onImageChange('');
    setStatus('idle');
  }

  return (
    <View style={styles.container}>
      <AccessibleText variant="small" color={colors.textSecondary}>
        Foto de la caja (opcional)
      </AccessibleText>
      <AccessibleText variant="small" color={colors.textSecondary}>
        Sin foto, el Adulto Mayor va a ver la forma y el color que elegiste arriba.
      </AccessibleText>

      {imageUri ? (
        <View style={styles.previewRow}>
          <Image source={{ uri: imageUri }} style={styles.preview} accessibilityLabel="Foto de la caja capturada" />
          <AccessibleButton label="Quitar foto" variant="secondary" onPress={handleRemove} />
        </View>
      ) : null}

      <View style={styles.actionsRow}>
        <AccessibleButton
          label="Sacar foto"
          onPress={() => handlePick('camera')}
          loading={status === 'saving'}
          disabled={status === 'saving'}
          accessibilityHint="Abre la cámara para fotografiar la caja del medicamento"
        />
        <AccessibleButton
          label="Elegir de galería"
          variant="secondary"
          onPress={() => handlePick('library')}
          loading={status === 'saving'}
          disabled={status === 'saving'}
        />
      </View>

      {status === 'error' ? (
        <AccessibleText color={colors.critical}>No pudimos guardar la foto. Intentá de nuevo.</AccessibleText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  preview: {
    width: 96,
    height: 96,
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: colors.border,
    ...shadows.pillShowcase,
  },
  actionsRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
});
