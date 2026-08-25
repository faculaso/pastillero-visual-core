import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { colors, radii, spacing, shadows } from '../../../design-system/tokens';

export interface PillboxCompartmentProps {
  readonly children: React.ReactNode;
  /** Identifica la toma actual — la tapita vuelve a abrirse cuando cambia (nueva toma cargada). */
  readonly doseId: string;
  /** Mismo disparador que ya usa `CelebrationOverlay` — no se inventa un segundo evento de "confirmado". */
  readonly celebrationTrigger: number;
}

const LID_OPEN_DURATION_MS = 650;

/**
 * "Pastillero" físico: una casilla azul con tapita que se abre para mostrar
 * el comprimido de este turno, en vez de una tarjeta plana. La tapita
 * (`lid`) es un `View` absoluto que cubre por completo a `children` y rota
 * sobre su borde superior (`transformOrigin: 'top'`) hasta desaparecer,
 * revelando `CurrentDoseCard` debajo — mismo idioma de animación que
 * `CelebrationOverlay` (`Animated` + `useNativeDriver`).
 */
export function PillboxCompartment({ children, doseId, celebrationTrigger }: PillboxCompartmentProps): React.JSX.Element {
  const lidOpen = useRef(new Animated.Value(0)).current;
  const pillBump = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    lidOpen.setValue(0);
    const animation = Animated.timing(lidOpen, {
      toValue: 1,
      duration: LID_OPEN_DURATION_MS,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
    // Se reabre solo cuando cambia la toma mostrada, no en cada re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doseId]);

  useEffect(() => {
    if (celebrationTrigger === 0) return;
    const animation = Animated.sequence([
      Animated.spring(pillBump, { toValue: 1.08, useNativeDriver: true, friction: 3, tension: 140 }),
      Animated.spring(pillBump, { toValue: 1, useNativeDriver: true, friction: 4 }),
    ]);
    animation.start();
    return () => animation.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [celebrationTrigger]);

  const lidRotateX = lidOpen.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-110deg'] });
  const lidOpacity = lidOpen.interpolate({ inputRange: [0, 0.55, 1], outputRange: [1, 1, 0] });

  return (
    <View style={styles.box} accessibilityElementsHidden={false}>
      <Animated.View style={[styles.contentWrapper, { transform: [{ scale: pillBump }] }]}>
        {children}
      </Animated.View>
      <Animated.View
        style={[
          styles.lid,
          {
            opacity: lidOpacity,
            transform: [{ perspective: 900 }, { rotateX: lidRotateX }],
          },
        ]}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <View style={styles.lidHandle} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    width: '100%',
    borderRadius: radii.xl,
    backgroundColor: colors.primaryDark,
    padding: spacing.sm,
    ...shadows.card,
  },
  contentWrapper: {
    borderRadius: radii.xl,
    overflow: 'hidden',
  },
  lid: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.primary,
    borderRadius: radii.xl,
    alignItems: 'center',
    justifyContent: 'center',
    // El hinge (borde superior) queda fijo mientras el resto rota hacia atrás.
    transformOrigin: 'top',
  },
  lidHandle: {
    width: 56,
    height: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.primaryLight,
    marginTop: spacing.md,
  },
});
