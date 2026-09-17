/**
 * Cuán bien se está cumpliendo un tratamiento. Existe por la misma razón
 * que `StockAlertLevel`: el porcentaje crudo no le dice a nadie si hay que
 * hacer algo, y dejar esa lectura en manos de cada pantalla llevó a que el
 * tablero del Cuidador pintara un 4% del mismo verde que un 100%.
 *
 * El corte de 80% es el umbral convencional en la literatura de adherencia
 * a la medicación para considerar que un tratamiento se está cumpliendo.
 * PARTIAL baja hasta 50% — de ahí para abajo el tratamiento prácticamente
 * no se está haciendo.
 */
export enum AdherenceLevel {
  GOOD = 'GOOD', // >= 80%
  PARTIAL = 'PARTIAL', // >= 50%
  POOR = 'POOR', // < 50%
}
