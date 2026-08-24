import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import type { VisualProfile } from '../../../../domain';
import { PillShape } from '../../../../domain';
import { colors, radii, spacing } from '../../../design-system/tokens';

export interface PillVisualProps {
  readonly visualProfile: VisualProfile;
  readonly size?: number;
  /** Nombre del medicamento, para el accessibilityLabel de la imagen — sin él, un lector de pantalla no puede describir la foto. */
  readonly medicationName?: string;
}

/**
 * Prioridad de renderizado (RF-02, "reconocimiento visual"):
 *  1. Foto real del comprimido (`pillImageUrl`) — la más fiel a lo que el
 *     usuario va a ver en su mano.
 *  2. Foto de la caja (`boxImageUrl`) — capturada en CU-01 vía
 *     `BoxPhotoCaptureField`, si no hay foto del comprimido en sí.
 *  3. Fallback geométrico (forma + color): SIEMPRE se renderiza, incluso con
 *     foto disponible pero aún no descargada/cacheada (offline-first: la
 *     imagen puede no estar disponible localmente todavía), o si el
 *     archivo local fue borrado externamente (`onError` lo detecta).
 */
export function PillVisual({ visualProfile, size = 160, medicationName }: PillVisualProps): React.JSX.Element {
  const [imageFailed, setImageFailed] = React.useState(false);
  const imageUrl = visualProfile.pillImageUrl ?? visualProfile.boxImageUrl;
  const showImage = Boolean(imageUrl) && !imageFailed;
  const imageLabel = medicationName ? `Foto del envase de ${medicationName}` : 'Foto del envase del medicamento';

  return (
    <View style={[styles.container, !showImage && styles.backdrop, { width: size, height: size }]}>
      {showImage ? (
        <Image
          source={{ uri: imageUrl }}
          style={[styles.image, { width: size, height: size, borderRadius: shapeRadius(visualProfile.shape, size) }]}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
          accessible
          accessibilityRole="image"
          accessibilityLabel={imageLabel}
          onError={() => setImageFailed(true)}
        />
      ) : visualProfile.shape === PillShape.TRIANGULAR ? (
        <View
          accessible
          accessibilityRole="image"
          accessibilityLabel={`Representación de la forma y color del comprimido${medicationName ? ` de ${medicationName}` : ''}`}
          style={[
            styles.triangle,
            {
              borderLeftWidth: size / 2,
              borderRightWidth: size / 2,
              borderBottomWidth: size * 0.85,
              borderBottomColor: visualProfile.color,
            },
          ]}
        />
      ) : (
        <View
          accessible
          accessibilityRole="image"
          accessibilityLabel={`Representación de la forma y color del comprimido${medicationName ? ` de ${medicationName}` : ''}`}
          style={[
            styles.shapeFallback,
            {
              width: size,
              height: shapeHeight(visualProfile.shape, size),
              backgroundColor: visualProfile.color,
              borderRadius: shapeRadius(visualProfile.shape, size),
            },
          ]}
        />
      )}
      {visualProfile.slotLabel ? (
        <View style={styles.slotBadge}>
          <View style={styles.slotBadgeDot} />
        </View>
      ) : null}
    </View>
  );
}

function shapeHeight(shape: PillShape, size: number): number {
  return shape === PillShape.CAPSULE ? size * 0.55 : size;
}

function shapeRadius(shape: PillShape, size: number): number {
  switch (shape) {
    case PillShape.ROUND:
      return size / 2;
    case PillShape.OVAL:
    case PillShape.CAPSULE:
      return size / 3;
    case PillShape.RECTANGULAR:
      return radii.sm;
    case PillShape.TRIANGULAR:
    case PillShape.OTHER:
      return radii.md;
  }
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  /**
   * Fondo neutro detrás del fallback geométrico — sin esto, un comprimido
   * blanco (color de swatch más elegido junto al resto) es indistinguible
   * del fondo blanco de la pantalla (`colors.background`), forma que sea.
   * Solo se aplica cuando NO hay foto real (esa ya cubre el área entera).
   */
  backdrop: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  image: {
    borderWidth: 2,
    borderColor: colors.border,
  },
  shapeFallback: {
    borderWidth: 2,
    borderColor: colors.border,
  },
  triangle: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  slotBadge: {
    position: 'absolute',
    bottom: -spacing.xs,
    right: -spacing.xs,
    width: 28,
    height: 28,
    borderRadius: radii.pill,
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotBadgeDot: {
    width: 10,
    height: 10,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
  },
});
