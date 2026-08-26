import { useSharedValue, useAnimatedStyle, withSequence, withTiming } from 'react-native-reanimated';

/**
 * Micro-sacudida horizontal para validación en tiempo real (credenciales,
 * código incorrecto, etc.). `trigger()` es imperativo y se dispara una sola
 * vez por error — no hay loop, así que el mock síncrono de Jest la resuelve
 * en un solo tick sin riesgo de recursión infinita.
 */
export function useShake() {
  const offset = useSharedValue(0);

  function trigger(): void {
    offset.value = withSequence(
      withTiming(-10, { duration: 45 }),
      withTiming(10, { duration: 45 }),
      withTiming(-8, { duration: 45 }),
      withTiming(8, { duration: 45 }),
      withTiming(-4, { duration: 40 }),
      withTiming(0, { duration: 40 }),
    );
  }

  const style = useAnimatedStyle(() => ({ transform: [{ translateX: offset.value }] }));

  return { style, trigger };
}
