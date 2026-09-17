import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, Path, Rect } from 'react-native-svg';

export interface DoseTakenAnimationProps {
  /** Se reinicia cada vez que cambia — mismo contrato que `celebrationTrigger`. */
  readonly trigger: number;
  /** Color real del comprimido confirmado (`visualProfile.color`). */
  readonly pillColor: string;
  readonly size?: number;
}

const SKIN = '#EFC39B';
const SKIN_SHADE = '#DCA87E';
const HAND = '#FBE0C4';
const HAND_SHADE = '#EBC6A2';
const LIP = '#D4796F';
const LIP_DARK = '#B75F57';
const MOUTH_INSIDE = '#7E3038';

/** Duración total de la secuencia (acerca → entra → traga → sonríe). */
export const DOSE_TAKEN_DURATION_MS = 1500;

/**
 * Confirmación de CU-02 paso 5: plano corto y plano de alguien llevándose el
 * comprimido a la boca, tragando y quedando con una sonrisa tranquila.
 *
 * Decisiones de dibujo:
 *  - El comprimido usa el color REAL de la dosis (`visualProfile.color`), no
 *    un color fijo: la pantalla acaba de prometer "así se ve tu pastilla"
 *    (RF-02), y mostrar otro color acá rompería esa promesa.
 *  - Encuadre sin ojos ni pelo a propósito: una cara concreta le diría al
 *    usuario que el protagonista es alguien que probablemente no es él. Solo
 *    se ve mejilla, mandíbula, boca y mano.
 *  - La masa de la cara SALE del viewBox por tres lados. Si se viera su
 *    contorno completo dejaría de leerse como un primer plano y pasaría a
 *    leerse como una carita redonda.
 *  - La mano es más clara que la cara (`HAND` vs `SKIN`): con el mismo tono
 *    los dedos se funden con la mejilla y el agarre desaparece.
 *
 * Decisiones técnicas:
 *  - Las bocas NO se interpolan como paths (React Native no hace morphing de
 *    SVG): son capas que se cruzan por opacidad.
 *  - Todo lo que se mueve son `View`s con transform/opacity — lo único que el
 *    native driver anima de forma confiable por encima de `react-native-svg`.
 */
export function DoseTakenAnimation({ trigger, pillColor, size = 240 }: DoseTakenAnimationProps): React.JSX.Element {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: DOSE_TAKEN_DURATION_MS,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);

  const handTranslateX = progress.interpolate({
    inputRange: [0, 0.38, 0.46, 0.66],
    outputRange: [-34, 0, 0, -30],
  });
  const handTranslateY = progress.interpolate({
    inputRange: [0, 0.38, 0.46, 0.66],
    outputRange: [30, 0, 0, 34],
  });
  const handOpacity = progress.interpolate({
    inputRange: [0, 0.08, 0.46, 0.64],
    outputRange: [0, 1, 1, 0],
  });

  // El comprimido se despega de los dedos y entra en la boca.
  const pillExtraX = progress.interpolate({ inputRange: [0, 0.38, 0.5], outputRange: [0, 0, 18] });
  const pillOpacity = progress.interpolate({ inputRange: [0, 0.08, 0.44, 0.5], outputRange: [0, 1, 1, 0] });

  const openOpacity = progress.interpolate({ inputRange: [0, 0.08, 0.52, 0.62], outputRange: [0, 1, 1, 0] });
  const closedOpacity = progress.interpolate({
    inputRange: [0.52, 0.62, 0.74, 0.84],
    outputRange: [0, 1, 1, 0],
  });
  const smileOpacity = progress.interpolate({ inputRange: [0.74, 0.86], outputRange: [0, 1] });

  // Cabeceo mínimo al tragar: sugiere el gesto sin animar un cuello.
  const swallowY = progress.interpolate({ inputRange: [0.6, 0.68, 0.78], outputRange: [0, 5, 0] });

  const layer = [styles.layer, { width: size, height: size }];
  const svgProps = { width: size, height: size, viewBox: '0 0 400 400' } as const;

  return (
    <View style={{ width: size, height: size }}>
      <Animated.View style={[...layer, { transform: [{ translateY: swallowY }] }]}>
        <Svg {...svgProps}>
          <Path d="M420 -20 L420 420 L210 420 Q120 330 128 205 Q136 70 240 -20 Z" fill={SKIN} />
          <Path d="M210 420 Q126 330 134 210 Q142 330 232 420 Z" fill={SKIN_SHADE} opacity={0.32} />
        </Svg>
      </Animated.View>

      <Animated.View style={[...layer, { opacity: openOpacity, transform: [{ translateY: swallowY }] }]}>
        <Svg {...svgProps}>
          <Defs>
            <ClipPath id="doseMouthHole">
              <Path d="M200 199 Q228 182 255 184 Q282 182 310 199 Q282 231 255 233 Q228 231 200 199 Z" />
            </ClipPath>
          </Defs>
          <Path
            d="M188 196 Q220 166 255 172 Q290 166 322 196 Q306 247 255 252 Q204 247 188 196 Z"
            fill={LIP}
          />
          <Path d="M200 199 Q228 182 255 184 Q282 182 310 199 Q282 231 255 233 Q228 231 200 199 Z" fill={MOUTH_INSIDE} />
          <G clipPath="url(#doseMouthHole)">
            <Rect x={195} y={178} width={130} height={24} rx={9} fill="#FFFFFF" />
          </G>
        </Svg>
      </Animated.View>

      <Animated.View style={[...layer, { opacity: closedOpacity, transform: [{ translateY: swallowY }] }]}>
        <Svg {...svgProps}>
          <Path d="M190 200 Q222 178 256 186 Q290 178 320 200 Q288 222 256 226 Q222 222 190 200 Z" fill={LIP} />
          <Path
            d="M190 200 Q224 194 256 196 Q288 194 320 200"
            fill="none"
            stroke={LIP_DARK}
            strokeWidth={3.5}
            strokeLinecap="round"
          />
        </Svg>
      </Animated.View>

      <Animated.View style={[...layer, { opacity: smileOpacity }]}>
        <Svg {...svgProps}>
          <Path
            d="M184 178 Q194 186 200 190 Q228 216 256 218 Q284 216 312 190 Q318 186 328 178 Q300 250 256 254 Q212 250 184 178 Z"
            fill={LIP}
          />
          <Path
            d="M184 178 Q222 216 256 218 Q290 216 328 178"
            fill="none"
            stroke={LIP_DARK}
            strokeWidth={4.5}
            strokeLinecap="round"
          />
        </Svg>
      </Animated.View>

      <Animated.View
        style={[
          ...layer,
          { opacity: handOpacity, transform: [{ translateX: handTranslateX }, { translateY: handTranslateY }] },
        ]}
      >
        <Svg {...svgProps}>
          {/* Dorso y dedos curvados, recortados por la esquina inferior izquierda. */}
          <Path d="M-20 344 Q44 298 116 322 Q180 344 190 420 L-20 420 Z" fill={HAND} />
          <G stroke={HAND_SHADE} strokeLinecap="round" fill="none">
            <Path d="M32 352 Q80 334 122 336" strokeWidth={28} />
            <Path d="M44 390 Q92 378 134 380" strokeWidth={26} />
          </G>
          {/* Pulgar (desde abajo) e índice (desde la izquierda): convergen sobre
              el comprimido desde ángulos distintos, que es lo que hace leer la
              pinza — dos dedos paralelos se leen como barras. */}
          <Path d="M166 330 Q182 292 186 246" stroke={HAND} strokeWidth={33} strokeLinecap="round" fill="none" />
          <Path d="M124 288 Q150 250 178 212" stroke={HAND} strokeWidth={34} strokeLinecap="round" fill="none" />
        </Svg>
      </Animated.View>

      <Animated.View
        style={[
          ...layer,
          {
            opacity: pillOpacity,
            transform: [
              { translateX: Animated.add(handTranslateX, pillExtraX) },
              { translateY: handTranslateY },
            ],
          },
        ]}
      >
        <Svg {...svgProps}>
          <Circle cx={196} cy={208} r={21} fill={pillColor} stroke="rgba(0,0,0,0.28)" strokeWidth={2} />
          <Ellipse cx={189} cy={200} rx={9} ry={5} fill="#FFFFFF" opacity={0.45} />
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', top: 0, left: 0 },
});
