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
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${ratio * 100}%`, backgroundColor: fillColor }]} />
      </View>
      <AccessibleText variant="small" color={labelColor} bold>
        {totalTaken} de {totalScheduled} tomas completadas
      </AccessibleText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  track: {
    height: 14,
    borderRadius: radii.pill,
    // Translúcido (no un color sólido de token) a propósito: esta barra se
    // dibuja directamente sobre el fondo teñido por turno de
    // `PastilleroVirtualScreen` (mañana/tarde/noche) — necesita funcionar
    // sobre los tres sin quedar invisible ni desentonar.
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radii.pill,
  },
});
