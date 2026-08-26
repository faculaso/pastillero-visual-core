import { useEffect } from 'react';
import { useSharedValue, useAnimatedStyle, withDelay, withSpring, interpolate } from 'react-native-reanimated';
import { ENTRANCE_SPRING, STAGGER_STEP_MS } from '../design-system/motion';

/**
 * Entrada escalonada estilo Motion.so: fade + slide-up amortiguado, cada
 * elemento arrancando `index * STAGGER_STEP_MS` después del anterior.
 * Dispara UNA sola vez al montar — no es un loop, así que es seguro tanto
 * en UI thread real como bajo el mock síncrono de Jest (`__mocks__/react-native-reanimated.js`).
 */
export function useStaggeredEntrance(index: number, distance = 22) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(index * STAGGER_STEP_MS, withSpring(1, ENTRANCE_SPRING));
    // Solo debe correr una vez al montar cada elemento — `index` es estable por instancia.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: interpolate(progress.value, [0, 1], [distance, 0]) }],
  }));
}
