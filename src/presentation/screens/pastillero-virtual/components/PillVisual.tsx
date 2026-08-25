import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect, Ellipse, Polygon, Line, ClipPath, G } from 'react-native-svg';
import type { VisualProfile } from '../../../../domain';
import { PillShape } from '../../../../domain';
import { colors, radii, spacing } from '../../../design-system/tokens';
import { shadeColor } from '../../../utils/shade-color';

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
 *     archivo local fue borrado externamente (`onError` lo detecta). Se
 *     dibuja con un gradiente + brillo especular (no un color plano) para
 *     que se lea como un objeto 3D real, no como un ícono.
 */
export function PillVisual({ visualProfile, size = 160, medicationName }: PillVisualProps): React.JSX.Element {
  const [imageFailed, setImageFailed] = React.useState(false);
  const imageUrl = visualProfile.pillImageUrl ?? visualProfile.boxImageUrl;
  const showImage = Boolean(imageUrl) && !imageFailed;
  const imageLabel = medicationName ? `Foto del envase de ${medicationName}` : 'Foto del envase del medicamento';
  const shapeLabel = `Representación de la forma y color del comprimido${medicationName ? ` de ${medicationName}` : ''}`;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
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
      ) : (
        <View accessible accessibilityRole="image" accessibilityLabel={shapeLabel}>
          <PillShapeArt
            shape={visualProfile.shape}
            color={visualProfile.color}
            secondaryColor={visualProfile.secondaryColor}
            size={size}
          />
        </View>
      )}
      {visualProfile.slotLabel ? (
        <View style={styles.slotBadge}>
          <View style={styles.slotBadgeDot} />
        </View>
      ) : null}
    </View>
  );
}

interface PillShapeArtProps {
  readonly shape: PillShape;
  readonly color: string;
  readonly secondaryColor?: string;
  readonly size: number;
}

/**
 * Cápsula/comprimido "glossy" vía gradiente lineal (claro arriba -> color
 * base -> oscuro abajo, mismos cortes 0%/35%/85%/100% que el mockup de
 * referencia) + una elipse de brillo especular encima. Para `CAPSULE_BICOLOR`
 * se arma un SEGUNDO gradiente a partir de `secondaryColor` — el resto de
 * las formas siguen con un único color, aclarado/oscurecido con `shadeColor`.
 */
function PillShapeArt({ shape, color, secondaryColor, size }: PillShapeArtProps): React.JSX.Element {
  const gradientId = React.useId().replace(/[^a-zA-Z0-9]/g, '');
  const width = size;
  const height = shapeHeight(shape, size);
  const light = shadeColor(color, 40);
  const dark = shadeColor(color, -35);
  const strokeColor = shadeColor(color, -55);

  const isBicolor = shape === PillShape.CAPSULE_BICOLOR && secondaryColor !== undefined;
  const secondaryGradientId = `${gradientId}b`;

  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={light} />
          <Stop offset="0.4" stopColor={color} />
          <Stop offset="1" stopColor={dark} />
        </LinearGradient>
        {isBicolor ? (
          <LinearGradient id={secondaryGradientId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={shadeColor(secondaryColor, 40)} />
            <Stop offset="0.4" stopColor={secondaryColor} />
            <Stop offset="1" stopColor={shadeColor(secondaryColor, -35)} />
          </LinearGradient>
        ) : null}
      </Defs>
      {renderShapeBody(
        shape,
        width,
        height,
        `url(#${gradientId})`,
        strokeColor,
        isBicolor ? `url(#${secondaryGradientId})` : undefined,
        gradientId,
      )}
    </Svg>
  );
}

function renderShapeBody(
  shape: PillShape,
  width: number,
  height: number,
  fill: string,
  stroke: string,
  secondaryFill: string | undefined,
  idPrefix: string,
): React.JSX.Element {
  const inset = 2;
  switch (shape) {
    case PillShape.ROUND:
      return (
        <>
          <Ellipse
            cx={width / 2}
            cy={height / 2}
            rx={width / 2 - inset}
            ry={height / 2 - inset}
            fill={fill}
            stroke={stroke}
            strokeWidth={1}
          />
          <Ellipse cx={width / 2} cy={height * 0.3} rx={width * 0.28} ry={height * 0.12} fill="#FFFFFF" opacity={0.35} />
        </>
      );
    case PillShape.OVAL:
      // Elipse alargada (rx > ry, ver `shapeHeight`) — a diferencia de ROUND
      // (círculo perfecto, rx === ry) y de CAPSULE (cápsula con lados
      // rectos). Antes usaba un `Rect` con las esquinas totalmente
      // redondeadas sobre una caja cuadrada, que con rx = ry termina siendo
      // un círculo indistinguible de ROUND.
      return (
        <>
          <Ellipse
            cx={width / 2}
            cy={height / 2}
            rx={width / 2 - inset}
            ry={height / 2 - inset}
            fill={fill}
            stroke={stroke}
            strokeWidth={1}
          />
          <Ellipse cx={width / 2} cy={height * 0.28} rx={width * 0.3} ry={height * 0.16} fill="#FFFFFF" opacity={0.3} />
        </>
      );
    case PillShape.CAPSULE:
      return (
        <>
          <Rect
            x={inset}
            y={inset}
            width={width - inset * 2}
            height={height - inset * 2}
            rx={(height - inset * 2) / 2}
            fill={fill}
            stroke={stroke}
            strokeWidth={1}
          />
          <Line x1={width / 2} y1={height * 0.18} x2={width / 2} y2={height * 0.82} stroke={stroke} strokeWidth={1.5} opacity={0.5} />
          <Ellipse cx={width / 2} cy={height * 0.28} rx={width * 0.34} ry={height * 0.14} fill="#FFFFFF" opacity={0.3} />
        </>
      );
    case PillShape.CAPSULE_BICOLOR: {
      // Misma silueta de cápsula que CAPSULE, pero recortada en dos mitades
      // (izquierda/derecha) con un `ClipPath` cada una, cada mitad pintada
      // con su propio gradiente — así los extremos redondeados de la
      // cápsula quedan intactos en cada color, en vez de un corte recto que
      // rompería la forma.
      const midX = width / 2;
      const bodyRx = (height - inset * 2) / 2;
      const rightFill = secondaryFill ?? fill;
      return (
        <>
          <Defs>
            <ClipPath id={`${idPrefix}-left`}>
              <Rect x={0} y={0} width={midX} height={height} />
            </ClipPath>
            <ClipPath id={`${idPrefix}-right`}>
              <Rect x={midX} y={0} width={width - midX} height={height} />
            </ClipPath>
          </Defs>
          <G clipPath={`url(#${idPrefix}-left)`}>
            <Rect
              x={inset}
              y={inset}
              width={width - inset * 2}
              height={height - inset * 2}
              rx={bodyRx}
              fill={fill}
              stroke={stroke}
              strokeWidth={1}
            />
          </G>
          <G clipPath={`url(#${idPrefix}-right)`}>
            <Rect
              x={inset}
              y={inset}
              width={width - inset * 2}
              height={height - inset * 2}
              rx={bodyRx}
              fill={rightFill}
              stroke={stroke}
              strokeWidth={1}
            />
          </G>
          <Line x1={midX} y1={inset} x2={midX} y2={height - inset} stroke={stroke} strokeWidth={1} opacity={0.6} />
          <Ellipse cx={width * 0.26} cy={height * 0.28} rx={width * 0.14} ry={height * 0.14} fill="#FFFFFF" opacity={0.3} />
          <Ellipse cx={width * 0.74} cy={height * 0.28} rx={width * 0.14} ry={height * 0.14} fill="#FFFFFF" opacity={0.3} />
        </>
      );
    }
    case PillShape.RECTANGULAR:
      return (
        <>
          <Rect
            x={inset}
            y={inset}
            width={width - inset * 2}
            height={height - inset * 2}
            rx={radii.sm}
            fill={fill}
            stroke={stroke}
            strokeWidth={1}
          />
          <Rect x={inset * 2} y={inset * 2} width={width - inset * 4} height={height * 0.22} rx={radii.sm} fill="#FFFFFF" opacity={0.22} />
        </>
      );
    case PillShape.TRIANGULAR:
      return (
        <>
          <Polygon
            points={`${width / 2},${inset} ${width - inset},${height - inset} ${inset},${height - inset}`}
            fill={fill}
            stroke={stroke}
            strokeWidth={1}
          />
          <Ellipse cx={width / 2} cy={height * 0.42} rx={width * 0.18} ry={height * 0.1} fill="#FFFFFF" opacity={0.28} />
        </>
      );
    case PillShape.OTHER:
      // Hexágono, no un rectángulo con esquinas más redondeadas que
      // RECTANGULAR (así se veía antes — casi calcado, mismo problema que
      // tenían ROUND/OVAL). "Otra" es un cajón de sastre para pastillas que
      // no encajan en ninguna de las 5 formas concretas, así que le
      // corresponde una silueta claramente distinta de todas ellas, no una
      // variación sutil de "Rectangular".
      return (
        <>
          <Polygon
            points={`${width * 0.3},${inset} ${width * 0.7},${inset} ${width - inset},${height / 2} ${width * 0.7},${height - inset} ${width * 0.3},${height - inset} ${inset},${height / 2}`}
            fill={fill}
            stroke={stroke}
            strokeWidth={1}
          />
          <Ellipse cx={width / 2} cy={height * 0.32} rx={width * 0.22} ry={height * 0.1} fill="#FFFFFF" opacity={0.28} />
        </>
      );
  }
}

/**
 * Solo ROUND queda cuadrada (`rx === ry` en `renderShapeBody` → círculo).
 * OVAL y CAPSULE se achatan para leerse como elipse/cápsula alargada en vez
 * de un círculo — con factores distintos entre sí para que tampoco se
 * confundan entre ellas.
 */
function shapeHeight(shape: PillShape, size: number): number {
  switch (shape) {
    case PillShape.CAPSULE:
    case PillShape.CAPSULE_BICOLOR:
      return size * 0.55;
    case PillShape.OVAL:
      return size * 0.68;
    default:
      return size;
  }
}

function shapeRadius(shape: PillShape, size: number): number {
  switch (shape) {
    case PillShape.ROUND:
      return size / 2;
    case PillShape.OVAL:
    case PillShape.CAPSULE:
    case PillShape.CAPSULE_BICOLOR:
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
  image: {
    borderWidth: 2,
    borderColor: colors.border,
  },
  slotBadge: {
    position: 'absolute',
    bottom: -spacing.xs,
    right: -spacing.xs,
    width: 28,
    height: 28,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
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
