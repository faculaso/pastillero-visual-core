import { useRef } from 'react';
import type { UseBoundStore, StoreApi } from 'zustand';
import {
  createPastilleroVirtualStore,
  type PastilleroVirtualDeps,
  type PastilleroVirtualState,
} from '../state/pastillero-virtual.store';

/**
 * `useRef` en vez de `useMemo`: necesitamos la garantía dura de "se crea
 * una única vez en el ciclo de vida del componente", no la garantía laxa
 * de `useMemo` (que React puede descartar y recrear bajo presión de
 * memoria). Perder la instancia del store a mitad de sesión perdería el
 * estado de "qué toma se está confirmando ahora mismo".
 */
export function usePastilleroVirtualStore(
  deps: PastilleroVirtualDeps,
): UseBoundStore<StoreApi<PastilleroVirtualState>> {
  const storeRef = useRef<UseBoundStore<StoreApi<PastilleroVirtualState>> | null>(null);
  if (storeRef.current === null) {
    storeRef.current = createPastilleroVirtualStore(deps);
  }
  return storeRef.current;
}
