import React from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import type { TimeOfDayTheme } from '../../../utils/time-of-day-theme';
import { shadeColor } from '../../../utils/shade-color';

export interface TimeOfDayBackdropProps {
  readonly theme: TimeOfDayTheme;
}

/**
 * Degradado vertical sutil sobre el color plano de `theme.background` — los
 * stops se derivan del mismo color con `shadeColor` (±6%, algo más marcado
 * de noche) en vez de una paleta nueva, así el contraste que ya calibró
 * `theme.accentText` contra el fondo plano se mantiene en todo el degradado.
 */
export function TimeOfDayBackdrop({ theme }: TimeOfDayBackdropProps): React.JSX.Element {
  const { width, height } = useWindowDimensions();
  const isNight = theme.period === 'night';
  const top = shadeColor(theme.background, isNight ? 10 : 6);
  const bottom = shadeColor(theme.background, isNight ? -14 : -6);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="timeOfDayBackdrop" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={top} />
            <Stop offset="1" stopColor={bottom} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill="url(#timeOfDayBackdrop)" />
      </Svg>
    </View>
  );
}
