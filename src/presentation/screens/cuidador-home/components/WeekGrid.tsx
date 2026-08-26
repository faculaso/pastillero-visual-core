import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import type { WeekDoseView } from '../../../../application';
import type { WeekDayBucket } from '../../../utils/group-doses-by-week';
import { buildQuadBuckets, QUAD_TURNOS, type QuadTurno } from '../../../utils/pastillero-quad-turno';
import { AccessibleText } from '../../../design-system/AccessibleText';
import { colors, radii, spacing } from '../../../design-system/tokens';
import { PastilleroCompartment } from './PastilleroCompartment';

export type Turno = QuadTurno;

export interface WeekGridProps {
  readonly buckets: readonly WeekDayBucket[];
  readonly onCellPress: (doses: readonly WeekDoseView[], label: string, turno: Turno) => void;
}

const DAY_LABELS = ['DOM', 'LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB'] as const;
const DAY_FULL = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'] as const;

function isToday(date: Date): boolean {
  const now = new Date();
  return date.toDateString() === now.toDateString();
}

/**
 * El "pastillero físico": bandeja de acrílico médico translúcido de 7 días ×
 * 4 turnos (MAÑ/MED/TAR/NOC — ver `pastillero-quad-turno.ts` para por qué
 * son 4 acá y no los 3 de siempre), cada casillero con una tapa 3D
 * (`PastilleroCompartment`) que se abre al tocar. Reemplaza la grilla plana
 * de puntitos de color por comprimidos reales (forma + color) dentro de un
 * pozo con sombra interna — pero el CONTRATO externo (`buckets`,
 * `onCellPress`) no cambió, así que `CuidadorHomeScreen` sigue igual.
 *
 * El chasis exterior tiene esquinas redondeadas, pero el `overflow: 'hidden'`
 * que las recorta vive SOLO en la capa de fondo decorativa (el gradiente
 * SVG, absolutamente posicionada detrás de todo) — nunca en un contenedor
 * que sea ancestro de un `PastilleroCompartment`. La grilla real (donde
 * viven las tapas que giran hasta -115deg y pueden proyectarse un poco más
 * allá de su propia celda al pasar la vertical) queda en una capa hermana
 * sin recorte, para que Android nunca corte una tapa a mitad de animación.
 */
export function WeekGrid({ buckets, onCellPress }: WeekGridProps): React.JSX.Element {
  const quadBuckets = buildQuadBuckets(buckets);

  return (
    <View style={styles.chassis}>
      <View style={styles.chassisBackground}>
        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
          <Defs>
            <LinearGradient id="chassisGradient" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#38BDF8" stopOpacity={0.22} />
              <Stop offset="0.5" stopColor="#0284C7" stopOpacity={0.12} />
              <Stop offset="1" stopColor="#0284C7" stopOpacity={0.2} />
            </LinearGradient>
            <LinearGradient id="chassisSheen" x1="0" y1="0" x2="1" y2="0.4">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.35} />
              <Stop offset="0.3" stopColor="#FFFFFF" stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width="100%" height="100%" rx={radii.lg} fill="url(#chassisGradient)" />
          <Rect x={0} y={0} width="100%" height="100%" rx={radii.lg} fill="url(#chassisSheen)" />
        </Svg>
      </View>

      <View style={styles.headerRow}>
        <View style={styles.turnoLabelCol} />
        {quadBuckets.map((bucket) => (
          <View key={bucket.dayIndex} style={styles.dayHeaderCell}>
            <AccessibleText
              variant="small"
              bold
              color={isToday(bucket.date) ? colors.primary : colors.textSecondary}
              style={styles.dayHeaderText}
            >
              {DAY_LABELS[bucket.dayIndex]}
            </AccessibleText>
          </View>
        ))}
      </View>

      {QUAD_TURNOS.map((turno) => (
        <View key={turno.key} style={styles.gridRow}>
          <View style={styles.turnoLabelCol}>
            <AccessibleText variant="small" bold color={colors.textSecondary} style={styles.turnoLabelText}>
              {turno.short}
            </AccessibleText>
          </View>
          {quadBuckets.map((bucket) => {
            const doses = bucket[turno.key];
            const label = `${DAY_FULL[bucket.dayIndex]} · ${turno.short}`;
            return (
              <PastilleroCompartment
                key={bucket.dayIndex}
                doses={doses}
                label={label}
                isToday={isToday(bucket.date)}
                onOpen={() => onCellPress(doses, label, turno.key)}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  chassis: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(2, 132, 199, 0.4)',
    backgroundColor: 'rgba(240, 249, 255, 0.6)',
    padding: spacing.sm,
    gap: 6,
    elevation: 3,
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
  },
  chassisBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  headerRow: { flexDirection: 'row', gap: 4 },
  gridRow: { flexDirection: 'row', gap: 4 },
  turnoLabelCol: { width: 34, alignItems: 'flex-end', justifyContent: 'center', paddingRight: 4 },
  turnoLabelText: { fontSize: 11, lineHeight: 13 },
  dayHeaderCell: { flex: 1, alignItems: 'center' },
  dayHeaderText: { fontSize: 11, lineHeight: 13 },
});
