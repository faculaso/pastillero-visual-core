import React, { useEffect, useRef, useState } from 'react';
import { View, Animated, StyleSheet, AccessibilityInfo } from 'react-native';
import { radii, shadows } from '../../../design-system/tokens';
import { DoseTakenAnimation, DOSE_TAKEN_DURATION_MS } from './DoseTakenAnimation';

export interface CelebrationOverlayProps {
  /** Cambia (se incrementa) cada vez que hay que disparar la animación — ver `celebrationTrigger` del store. */
  readonly trigger: number;
  /** Color real del comprimido recién confirmado (`visualProfile.color`). */
  readonly pillColor?: string;
  /** Nombre del medicamento recién confirmado — solo para el anuncio accesible. */
  readonly medicationName?: string;
}

const HOLD_AFTER_ANIMATION_MS = 240;
const FADE_OUT_DURATION_MS = 280;
const DEFAULT_PILL_COLOR = '#E53935';

/**
 * CU-02 paso 5: confirmación de que la toma quedó registrada. Muestra un
 * plano corto de alguien tomando el comprimido (ver `DoseTakenAnimation`) en
 * vez del tilde sobre destello verde anterior — un tilde confirma "algo
 * salió bien", no "te tomaste tu remedio".
 * `pointerEvents="none"`: es puramente decorativo, nunca debe interceptar un
 * toque destinado a otro elemento de la pantalla.
 *
 * El overlay está oculto para lectores de pantalla (una animación no se
 * puede "leer"), pero el hecho que representa SÍ se anuncia con
 * `announceForAccessibility`: sin eso, el cambio de estado más importante de
 * la app era completamente silencioso para tecnología asistiva.
 *
 * No anima en el montaje inicial (`trigger === 0` se ignora a propósito):
 * el efecto es una CONSECUENCIA de confirmar, no algo que deba dispararse
 * solo por abrir la pantalla.
 */
export function CelebrationOverlay({
  trigger,
  pillColor = DEFAULT_PILL_COLOR,
  medicationName,
}: CelebrationOverlayProps): React.JSX.Element | null {
  const [visible, setVisible] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (trigger === 0) return;

    setVisible(true);
    opacity.setValue(1);
    AccessibilityInfo.announceForAccessibility(
      medicationName ? `Listo. Tomaste ${medicationName}.` : 'Listo. Toma confirmada.',
    );

    const animation = Animated.sequence([
      Animated.delay(DOSE_TAKEN_DURATION_MS + HOLD_AFTER_ANIMATION_MS),
      Animated.timing(opacity, { toValue: 0, duration: FADE_OUT_DURATION_MS, useNativeDriver: true }),
    ]);

    animation.start(({ finished }) => {
      if (finished) setVisible(false);
    });

    return () => animation.stop();
    // `medicationName` queda fuera a propósito: el anuncio pertenece al
    // evento de confirmar, no a un cambio de nombre en pleno vuelo.
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
      <Animated.View style={[styles.scrim, { opacity }]} />
      <Animated.View style={[styles.stage, { opacity }]}>
        <DoseTakenAnimation trigger={trigger} pillColor={pillColor} />
      </Animated.View>
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
  scrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#0F172A',
    opacity: 0.45,
  },
  stage: {
    backgroundColor: '#FFFFFF',
    borderRadius: radii.xl,
    overflow: 'hidden',
    ...shadows.card,
  },
});
