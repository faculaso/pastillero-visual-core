import React from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { colors } from '../../../design-system/tokens';

/**
 * Fondo de marca estático para "Mi semana" — mismo lenguaje visual que el
 * resto del lado Adulto Mayor (degradado sutil + un glow azul suave), sin
 * depender de un turno del día como `TimeOfDayBackdrop` (esta pantalla
 * muestra los 7 días juntos, no tiene un "turno actual" que teñir).
 */
export function WeekBackdrop(): React.JSX.Element {
  const { width, height } = useWindowDimensions();

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="weekBackdrop" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.background} stopOpacity={1} />
            <Stop offset="1" stopColor={colors.background} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill="url(#weekBackdrop)" />
      </Svg>
    </View>
  );
}
