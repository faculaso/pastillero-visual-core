import React from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { authPalette } from '../theme/auth-theme';

/**
 * Fondo de marca del flujo de auth: degradado vertical sutil + un par de
 * "glows" azules translúcidos superpuestos (sin librería de blur en el
 * proyecto — se simula el efecto con círculos de opacidad baja, la misma
 * técnica de capas que ya usa `PastilleroCompartment` con `react-native-svg`
 * para su placa con gradiente). Estático a propósito: nada de loops de
 * animación acá (ver nota en `useStaggeredEntrance` sobre por qué el mock
 * de Reanimated de Jest no tolera animaciones que se re-disparan solas).
 */
export function AuthGradientBackground(): React.JSX.Element {
  const { width, height } = useWindowDimensions();

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="authBackdrop" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={authPalette.gradientTop} stopOpacity={1} />
            <Stop offset="1" stopColor={authPalette.gradientBottom} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill="url(#authBackdrop)" />
        <Circle cx={width * 0.85} cy={height * 0.08} r={width * 0.45} fill={authPalette.glowSoft} />
        <Circle cx={width * 0.1} cy={height * 0.28} r={width * 0.35} fill={authPalette.glow} opacity={0.5} />
      </Svg>
    </View>
  );
}
