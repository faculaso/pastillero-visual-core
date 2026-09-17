import React from 'react';
import { View, StyleSheet } from 'react-native';
import { AccessibleText } from '../../../design-system/AccessibleText';
import { colors, radii, spacing } from '../../../design-system/tokens';

export interface DailyProgressBarProps {
  readonly totalScheduled: number;
  readonly totalTaken: number;
  /** Color del texto del label — por defecto `colors.textSecondary`, pero
   * `PastilleroVirtualScreen` pasa `theme.accentText` porque esta barra se
   * dibuja sobre el fondo teñido por turno, no sobre una tarjeta blanca. */
  readonly labelColor?: string;
  /** Color de la ranura — mismo motivo que `labelColor`: el default está
   * calculado contra superficies claras y desaparece sobre el fondo oscuro
   * del turno noche. `PastilleroVirtualScreen` pasa `theme.recessedSurface`. */
  readonly trackColor?: string;
}

/**
 * "Barra de progreso curva y colorida" — cápsula totalmente redondeada
 * (`radii.pill`), sin dependencias de SVG/gráficos nuevas: el efecto
 * "curva" viene de la forma cápsula del track y el relleno, no de un arco
 * radial. Verde cuando se completó todo, azul primario mientras está en
 * progreso — nunca rojo/alarmante, ni a mitad de día ni con 0 tomas.
 */
export function DailyProgressBar({
  totalScheduled,
  totalTaken,
  labelColor = colors.textSecondary,
  trackColor = 'rgba(15, 23, 42, 0.1)',
}: DailyProgressBarProps): React.JSX.Element | null {
  if (totalScheduled === 0) return null; // nada que mostrar si no hay tomas programadas hoy

  const ratio = Math.min(1, totalTaken / totalScheduled);
  const isComplete = totalTaken >= totalScheduled;
  const fillColor = isComplete ? colors.success : colors.primary;

  return (
    <View
      style={styles.container}
      accessible
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: totalScheduled, now: totalTaken }}
      accessibilityLabel={`${totalTaken} de ${totalScheduled} tomas completadas hoy`}
    >
      <View style={[styles.track, { backgroundColor: trackColor }]}>
        <View style={[styles.fill, { width: `${ratio * 100}%`, backgroundColor: fillColor }]} />
      </View>
      <AccessibleText variant="small" color={labelColor} bold style={styles.label}>
        {totalTaken} de {totalScheduled} tomas completadas
      </AccessibleText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  label: { textAlign: 'center' },
  track: {
    height: 14,
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radii.pill,
  },
});
