import React from 'react';
import { View, StyleSheet } from 'react-native';
import type { WeekDayBucket } from '../../../utils/group-doses-by-week';
import { AccessibleText } from '../../../design-system/AccessibleText';
import { colors, radii, spacing } from '../../../design-system/tokens';
import { TurnoRow } from './TurnoRow';

export interface DaySectionProps {
  readonly bucket: WeekDayBucket;
  readonly isToday: boolean;
  readonly onPressTodayPending: () => void;
}

const DAY_FULL = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'] as const;

const TURNOS = [
  { key: 'morning' as const, emoji: '🌅', label: 'Mañana' },
  { key: 'afternoon' as const, emoji: '☀️', label: 'Tarde' },
  { key: 'night' as const, emoji: '🌙', label: 'Noche' },
];

function isPending(doses: WeekDayBucket['morning']): boolean {
  return doses.some((d) => d.status === 'PENDING');
}

export function DaySection({ bucket, isToday, onPressTodayPending }: DaySectionProps): React.JSX.Element {
  const isFutureDay = bucket.date.getTime() > new Date().setHours(0, 0, 0, 0);

  return (
    <View style={[styles.container, isToday && styles.containerToday]}>
      <AccessibleText variant="label" bold color={isToday ? colors.primaryDark : colors.textPrimary}>
        {DAY_FULL[bucket.dayIndex]}
        {isToday ? ' · Hoy' : ''}
      </AccessibleText>

      <View style={styles.rows}>
        {TURNOS.map((turno) => {
          const doses = bucket[turno.key];
          const interactive = isToday && isPending(doses);
          return (
            <TurnoRow
              key={turno.key}
              emoji={turno.emoji}
              label={turno.label}
              doses={doses}
              interactive={interactive}
              isFutureDay={isFutureDay}
              onPress={interactive ? onPressTodayPending : undefined}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.xl,
  },
  containerToday: {
    backgroundColor: colors.primarySoft,
  },
  rows: { gap: spacing.sm },
});
