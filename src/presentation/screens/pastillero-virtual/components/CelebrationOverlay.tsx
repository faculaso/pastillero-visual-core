import React, { useEffect, useRef, useState } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { AccessibleText } from '../../../design-system/AccessibleText';
import { colors, radii } from '../../../design-system/tokens';

export interface CelebrationOverlayProps {
  /** Cambia (se incrementa) cada vez que hay que disparar la animación — ver `celebrationTrigger` del store. */
  readonly trigger: number;
}

const VISIBLE_DURATION_MS = 900;
const FADE_OUT_DURATION_MS = 300;
const CONFETTI = ['🎉', '✨', '🎊', '✨'];

const CONFETTI_POSITIONS = [
  { top: '30%', left: '20%' },
  { top: '25%', right: '20%' },
  { bottom: '30%', left: '25%' },
  { bottom: '28%', right: '22%' },
] as const;

/**
 * CU-02 paso 5: refuerzo positivo al presionar "Confirmar Toma" — checkmark
 * con escala (spring) + destello verde esmeralda de fondo + un puñado de
 * confeti sutil. `pointerEvents="none"`: es puramente decorativo, nunca
 * debe interceptar un toque destinado a otro elemento de la pantalla.
 *
 * No anima en el montaje inicial (`trigger === 0` se ignora a propósito):
 * el efecto es una CONSECUENCIA de confirmar, no algo que deba dispararse
 * solo por abrir la pantalla.
 */
export function CelebrationOverlay({ trigger }: CelebrationOverlayProps): React.JSX.Element | null {
  const [visible, setVisible] = useState(false);
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (trigger === 0) return;

    setVisible(true);
    scale.setValue(0);
    opacity.setValue(1);

    const animation = Animated.sequence([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 4, tension: 120 }),
      Animated.delay(VISIBLE_DURATION_MS),
      Animated.timing(opacity, { toValue: 0, duration: FADE_OUT_DURATION_MS, useNativeDriver: true }),
    ]);

    animation.start(({ finished }) => {
      if (finished) setVisible(false);
    });

    return () => animation.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);

  if (!visible) return null;

  return (
    <View
      style={styles.overlay}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Animated.View style={[styles.flash, { opacity }]} />
      <Animated.View style={[styles.checkCircle, { transform: [{ scale }], opacity }]}>
        <AccessibleText variant="display" color="#FFFFFF" bold>
          ✓
        </AccessibleText>
      </Animated.View>
      {CONFETTI.map((emoji, index) => (
        <Animated.Text key={index} style={[styles.confettiParticle, CONFETTI_POSITIONS[index], { opacity }]}>
          {emoji}
        </Animated.Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  flash: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.success,
    opacity: 0.12,
  },
  checkCircle: {
    width: 120,
    height: 120,
    borderRadius: radii.pill,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confettiParticle: {
    position: 'absolute',
    fontSize: 28,
  },
});
