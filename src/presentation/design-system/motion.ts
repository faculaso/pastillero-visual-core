/**
 * Timings de movimiento compartidos por toda la app — no solo Auth. Ver
 * `useStaggeredEntrance`/`useShake` (`presentation/hooks/`) para dónde se
 * consumen.
 */
export const ENTRANCE_SPRING = { damping: 18, stiffness: 140 } as const;
export const PRESS_SPRING = { damping: 14, stiffness: 260 } as const;

/** Ms entre cada elemento de una entrada escalonada (Motion.so-like). */
export const STAGGER_STEP_MS = 70;
