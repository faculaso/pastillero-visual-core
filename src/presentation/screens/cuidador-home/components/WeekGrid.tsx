import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import type { WeekDoseView } from '../../../../application';
import { DoseStatus } from '../../../../domain';
import type { WeekDayBucket } from '../../../utils/group-doses-by-week';
import { AccessibleText } from '../../../design-system/AccessibleText';
import { colors, radii, spacing } from '../../../design-system/tokens';

export type Turno = 'morning' | 'afternoon' | 'night';

export interface WeekGridProps {
  readonly buckets: readonly WeekDayBucket[];
  readonly onCellPress: (doses: readonly WeekDoseView[], label: string, turno: Turno) => void;
}

const DAY_LABELS = ['DOM', 'LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB'] as const;
const DAY_FULL = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'] as const;

const TURNOS: ReadonlyArray<{ readonly key: Turno; readonly short: string; readonly emoji: string }> = [
  { key: 'morning', short: 'MAÑ', emoji: '🌅' },
  { key: 'afternoon', short: 'TAR', emoji: '☀️' },
  { key: 'night', short: 'NOC', emoji: '🌙' },
];

function isToday(date: Date): boolean {
  const now = new Date();
  return date.toDateString() === now.toDateString();
}

/**
 * Grilla 7 días × 3 turnos (no 4 — esta app usa 3 turnos en todos lados, ver
 * `time-of-day-theme.ts`). Cada celda se ve "llena" (fondo/borde azul) si
 * tiene dosis programadas, y muestra un puntito por medicamento con su
 * color real (`visualProfile.color`) — sin la tapita animada del diseño
 * original: a esta densidad (21 celdas) la animación por celda no aporta y
 * complica la interacción; acá el gesto es "tocar para ver el detalle".
 *
 * TODAS las celdas son tocables, no solo las que tienen dosis: el pastillero
 * es el punto central para manejar la semana, así que tocar un casillero
 * vacío es también la forma de agregar un tratamiento para ese día/turno
 * (ver `WeekCellDetailModal` — ya no hay un botón "+" flotante separado).
 */
export function WeekGrid({ buckets, onCellPress }: WeekGridProps): React.JSX.Element {
  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.turnoLabelCol} />
        {buckets.map((bucket) => (
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

      {TURNOS.map((turno) => (
        <View key={turno.key} style={styles.gridRow}>
          <View style={styles.turnoLabelCol}>
            <AccessibleText variant="small" bold color={colors.textSecondary} style={styles.turnoLabelText}>
              {turno.short}
            </AccessibleText>
          </View>
          {buckets.map((bucket) => {
            const doses = bucket[turno.key];
            const hasDoses = doses.length > 0;
            const label = `${DAY_FULL[bucket.dayIndex]} · ${turno.short}`;
            return (
              <Pressable
                key={bucket.dayIndex}
                onPress={() => onCellPress(doses, label, turno.key)}
                accessibilityRole="button"
                accessibilityLabel={
                  hasDoses
                    ? `${label} — ${doses.length} medicamento(s)`
                    : `${label} — sin dosis programadas, tocá para agregar un tratamiento`
                }
                style={[
                  styles.cell,
                  hasDoses ? styles.cellFilled : styles.cellEmpty,
                  isToday(bucket.date) && styles.cellToday,
                ]}
              >
                {hasDoses ? (
                  <View style={styles.dots}>
                    {doses.slice(0, 4).map((dose) => (
                      <View key={dose.doseId} style={[styles.dot, { backgroundColor: dose.visualProfile.color }]} />
                    ))}
                  </View>
                ) : null}
                {hasDoses && doses.every((d) => d.status === DoseStatus.TAKEN) ? (
                  <AccessibleText variant="small" bold color={colors.success} style={styles.checkMark}>
                    ✓
                  </AccessibleText>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6 },
  headerRow: { flexDirection: 'row', gap: 4 },
  gridRow: { flexDirection: 'row', gap: 4 },
  turnoLabelCol: { width: 34, alignItems: 'flex-end', justifyContent: 'center', paddingRight: 4 },
  turnoLabelText: { fontSize: 11, lineHeight: 13 },
  dayHeaderCell: { flex: 1, alignItems: 'center' },
  dayHeaderText: { fontSize: 11, lineHeight: 13 },
  cell: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: radii.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellEmpty: {
    backgroundColor: colors.surfaceSubtle,
    borderColor: colors.borderLight,
  },
  cellFilled: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primaryLight,
  },
  cellToday: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  dots: { flexDirection: 'row', flexWrap: 'wrap', gap: 2, justifyContent: 'center', maxWidth: 28 },
  dot: {
    width: 7,
    height: 7,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.15)',
  },
  checkMark: { position: 'absolute', bottom: 1, right: 2, fontSize: 10 },
});
