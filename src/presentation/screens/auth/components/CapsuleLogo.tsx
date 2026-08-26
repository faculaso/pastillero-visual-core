import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import Svg, { Defs, G, LinearGradient, Rect, Stop } from 'react-native-svg';
import { authPalette } from '../theme/auth-theme';
import { radii } from '../../../design-system/tokens';

const SIZE = 64;

/**
 * Logo de marca: cápsula estilizada (dos mitades — contorno + relleno con
 * degradado clínico) dentro de una placa redondeada, con un barrido de
 * brillo que cruza UNA sola vez al montar (no un loop continuo — ver la
 * nota de `useStaggeredEntrance` sobre por qué el mock de Reanimated de
 * Jest no tolera animaciones que se re-disparan solas).
 */
export function CapsuleLogo(): React.JSX.Element {
  const shine = useSharedValue(-1);

  useEffect(() => {
    shine.value = withDelay(280, withTiming(1, { duration: 700 }));
    // Dispara una única vez, al montar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shineStyle = useAnimatedStyle(() => ({
    opacity: shine.value < 1 ? 0.55 : 0,
    transform: [{ translateX: shine.value * SIZE * 1.4 }, { rotate: '20deg' }],
  }));

  return (
    <View style={styles.badge}>
      <Svg width={SIZE * 0.72} height={SIZE * 0.72} viewBox="0 0 56 56">
        <Defs>
          <LinearGradient id="capsuleAccent" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={authPalette.clinicalBlue} />
            <Stop offset="1" stopColor={authPalette.clinicalBlueLight} />
          </LinearGradient>
        </Defs>
        <G rotation={-40} origin="28,28">
          <Rect x={6} y={20} width={44} height={16} rx={8} fill="#FFFFFF" stroke="url(#capsuleAccent)" strokeWidth={2.5} />
          <Rect x={28} y={20} width={22} height={16} rx={8} fill="url(#capsuleAccent)" />
        </G>
      </Svg>
      <View style={styles.shineClip} pointerEvents="none">
        <Animated.View style={[styles.shineBar, shineStyle]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    width: SIZE,
    height: SIZE,
    borderRadius: radii.xl,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: authPalette.clinicalBlue,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: authPalette.cardBorder,
  },
  shineClip: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: radii.xl, overflow: 'hidden' },
  shineBar: {
    position: 'absolute',
    top: -SIZE * 0.5,
    left: -SIZE * 0.3,
    width: SIZE * 0.35,
    height: SIZE * 2,
    backgroundColor: '#FFFFFF',
  },
});
