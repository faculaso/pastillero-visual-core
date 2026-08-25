import React, { useMemo, useRef, useState } from 'react';
import { View, PanResponder, StyleSheet, type GestureResponderEvent } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { AccessibleText } from '../../../design-system/AccessibleText';
import { colors, radii, spacing } from '../../../design-system/tokens';
import { hexToHsv, hsvToHex, type HsvColor } from '../../../utils/hsv-color';

export interface ColorWheelPickerProps {
  /** Color actual (hex), usado solo para posicionar los thumbs al abrir el selector — después el estado vive acá adentro. */
  readonly value: string;
  readonly onChange: (hex: string) => void;
}

const SV_SIZE = 240;
const HUE_HEIGHT = 32;
const THUMB_SIZE = 26;

/** Paradas de matiz puro (S=1, V=1) cada 60° para el gradiente arcoíris de la tira de hue. */
const HUE_STOPS = [0, 60, 120, 180, 240, 300, 360].map((h) => hsvToHex({ h, s: 1, v: 1 }));

/**
 * Selector de color completo (rueda de matiz + cuadrado de saturación/brillo),
 * alternativa a los 6 swatches fijos de `VisualProfileEditor` cuando el
 * Cuidador quiere un color exacto que no está entre los preseleccionados.
 * `onChange` se dispara en cada movimiento del dedo (no solo al soltar) —
 * mismo feedback inmediato que tocar un swatch.
 */
export function ColorWheelPicker({ value, onChange }: ColorWheelPickerProps): React.JSX.Element {
  const [hsv, setHsv] = useState<HsvColor>(() => hexToHsv(value));

  // `nativeEvent.locationX/Y` no es confiable acá: en Android con Fabric,
  // cuando el toque cae sobre uno de los `Rect` internos del `Svg` (no
  // sobre el `View` contenedor), esas coordenadas vienen relativas a ESE
  // nodo interno en vez del cuadro completo — el resultado observado era
  // que, sin importar dónde tocaras, `s`/`v` quedaban siempre cerca de su
  // máximo y el matiz nunca cambiaba, dando siempre rojo puro. Medimos la
  // posición en pantalla del contenedor una vez (`onLayout` + `measure`) y
  // calculamos la posición local a mano con `pageX`/`pageY`, que sí son
  // consistentes sin importar qué nodo nativo haya recibido el toque.
  const svOrigin = useRef({ x: 0, y: 0 });
  const svSquareRef = useRef<React.ComponentRef<typeof View>>(null);
  const hueOrigin = useRef({ x: 0, y: 0 });
  const hueStripRef = useRef<React.ComponentRef<typeof View>>(null);

  function updateFromSv(pageX: number, pageY: number): void {
    const x = pageX - svOrigin.current.x;
    const y = pageY - svOrigin.current.y;
    const next: HsvColor = { ...hsv, s: clamp01(x / SV_SIZE), v: clamp01(1 - y / SV_SIZE) };
    setHsv(next);
    onChange(hsvToHex(next));
  }

  function updateFromHue(pageX: number): void {
    const x = pageX - hueOrigin.current.x;
    const next: HsvColor = { ...hsv, h: clamp01(x / SV_SIZE) * 360 };
    setHsv(next);
    onChange(hsvToHex(next));
  }

  function measureSvOrigin(): void {
    svSquareRef.current?.measure((_x, _y, _w, _h, pageX, pageY) => {
      svOrigin.current = { x: pageX, y: pageY };
    });
  }

  function measureHueOrigin(): void {
    hueStripRef.current?.measure((_x, _y, _w, _h, pageX, pageY) => {
      hueOrigin.current = { x: pageX, y: pageY };
    });
  }

  const svResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (event: GestureResponderEvent) =>
        updateFromSv(event.nativeEvent.pageX, event.nativeEvent.pageY),
      onPanResponderMove: (event: GestureResponderEvent) =>
        updateFromSv(event.nativeEvent.pageX, event.nativeEvent.pageY),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ).current;

  const hueResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (event: GestureResponderEvent) => updateFromHue(event.nativeEvent.pageX),
      onPanResponderMove: (event: GestureResponderEvent) => updateFromHue(event.nativeEvent.pageX),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ).current;

  const pureHueHex = useMemo(() => hsvToHex({ h: hsv.h, s: 1, v: 1 }), [hsv.h]);
  const selectedHex = useMemo(() => hsvToHex(hsv), [hsv]);

  return (
    <View style={styles.container}>
      <View
        ref={svSquareRef}
        onLayout={measureSvOrigin}
        style={styles.svSquare}
        {...svResponder.panHandlers}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="Saturación y brillo del color"
      >
        <Svg width={SV_SIZE} height={SV_SIZE}>
          <Defs>
            <LinearGradient id="saturation" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={1} />
              <Stop offset="1" stopColor={pureHueHex} stopOpacity={1} />
            </LinearGradient>
            <LinearGradient id="brightness" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#000000" stopOpacity={0} />
              <Stop offset="1" stopColor="#000000" stopOpacity={1} />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={SV_SIZE} height={SV_SIZE} fill="url(#saturation)" />
          <Rect x={0} y={0} width={SV_SIZE} height={SV_SIZE} fill="url(#brightness)" />
        </Svg>
        <View
          pointerEvents="none"
          style={[
            styles.thumb,
            {
              left: hsv.s * SV_SIZE - THUMB_SIZE / 2,
              top: (1 - hsv.v) * SV_SIZE - THUMB_SIZE / 2,
              backgroundColor: selectedHex,
            },
          ]}
        />
      </View>

      <View
        ref={hueStripRef}
        onLayout={measureHueOrigin}
        style={styles.hueStrip}
        {...hueResponder.panHandlers}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="Matiz del color"
      >
        <Svg width={SV_SIZE} height={HUE_HEIGHT}>
          <Defs>
            <LinearGradient id="hue" x1="0" y1="0" x2="1" y2="0">
              {HUE_STOPS.map((hex, index) => (
                <Stop key={`${hex}-${index}`} offset={index / (HUE_STOPS.length - 1)} stopColor={hex} stopOpacity={1} />
              ))}
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={SV_SIZE} height={HUE_HEIGHT} rx={HUE_HEIGHT / 2} fill="url(#hue)" />
        </Svg>
        <View
          pointerEvents="none"
          style={[styles.hueThumb, { left: (hsv.h / 360) * SV_SIZE - THUMB_SIZE / 2, backgroundColor: pureHueHex }]}
        />
      </View>

      <View style={styles.previewRow}>
        <View style={[styles.previewSwatch, { backgroundColor: selectedHex }]} />
        <AccessibleText variant="small" color={colors.textSecondary}>
          {selectedHex}
        </AccessibleText>
      </View>
    </View>
  );
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

const styles = StyleSheet.create({
  container: { gap: spacing.md, alignItems: 'center' },
  svSquare: {
    width: SV_SIZE,
    height: SV_SIZE,
    borderRadius: radii.md,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.border,
  },
  hueStrip: {
    width: SV_SIZE,
    height: HUE_HEIGHT,
    justifyContent: 'center',
  },
  thumb: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    elevation: 4,
    shadowColor: '#000000',
    shadowOpacity: 0.3,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  hueThumb: {
    position: 'absolute',
    top: -(THUMB_SIZE - HUE_HEIGHT) / 2,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    elevation: 4,
    shadowColor: '#000000',
    shadowOpacity: 0.3,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  previewSwatch: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.border,
  },
});
