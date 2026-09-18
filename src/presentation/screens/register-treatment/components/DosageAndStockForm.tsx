import React from 'react';
import { View, TextInput, Pressable, ScrollView, StyleSheet } from 'react-native';
import { MeasurementUnit } from '../../../../domain';
import { AccessibleText } from '../../../design-system/AccessibleText';
import { colors, radii, spacing, touchTarget, typography } from '../../../design-system/tokens';
import { formatStartDayLabel, formatTreatmentPeriod } from '../../../utils/treatment-dates';

/** Hoy, mañana y los cinco días siguientes: cubre "empieza ahora" y "empieza tal día de esta semana". */
const START_OFFSETS = [0, 1, 2, 3, 4, 5, 6] as const;

const DURATIONS: ReadonlyArray<{ label: string; days: number | null }> = [
  { label: '7 días', days: 7 },
  { label: '14 días', days: 14 },
  { label: '30 días', days: 30 },
  { label: 'Sin fecha de fin', days: null },
];

export interface DosageAndStockFormValue {
  readonly timeHour: string;
  readonly timeMinute: string;
  readonly dosageAmount: string;
  readonly dosageUnit: MeasurementUnit;
  readonly initialStock: string;
  readonly dailyConsumption: string;
  readonly allDays: boolean;
  /** 0 = hoy, 1 = mañana, … Antes el alta siempre arrancaba "ahora", sin opción. */
  readonly startOffsetDays: number;
  /** `null` = crónico, sin fecha de fin. */
  readonly durationDays: number | null;
  /** 0(dom)-6(sáb). Solo se usa cuando `allDays` es `false`. */
  readonly weekdays: readonly number[];
}

export interface DosageAndStockFormProps {
  readonly value: DosageAndStockFormValue;
  readonly onChange: (value: DosageAndStockFormValue) => void;
}

/**
 * Días de la semana, en el orden en que los lee cualquier calendario en
 * castellano. El índice ES el valor que espera el dominio
 * (`DosageScheme.weekdays`, 0 = domingo), así que no hay tabla de
 * conversión que se pueda desincronizar.
 */
const DIAS: readonly { readonly value: number; readonly corto: string; readonly largo: string }[] = [
  { value: 0, corto: 'D', largo: 'Domingo' },
  { value: 1, corto: 'L', largo: 'Lunes' },
  { value: 2, corto: 'M', largo: 'Martes' },
  { value: 3, corto: 'M', largo: 'Miércoles' },
  { value: 4, corto: 'J', largo: 'Jueves' },
  { value: 5, corto: 'V', largo: 'Viernes' },
  { value: 6, corto: 'S', largo: 'Sábado' },
];

/**
 * CU-01 paso 8 (RF-01, RF-05).
 *
 * El checkbox "Todos los días" existía pero NO HACÍA NADA: destildarlo no
 * mostraba nada y el tratamiento se guardaba como DAILY igual. En una app
 * de medicación eso es de lo peor que puede pasar — el Cuidador cree que
 * configuró martes y jueves, y el remedio le suena al Adulto Mayor los
 * siete días. El control estaba visible y mentía.
 *
 * El dominio ya soportaba `SPECIFIC_WEEKDAYS` entero (validación en
 * `createDosageScheme`, generación en `calculateScheduledDoseTimes`, y el
 * CHECK de la tabla): lo único que faltaba era esta UI y pasarle el valor.
 */
export function DosageAndStockForm({ value, onChange }: DosageAndStockFormProps): React.JSX.Element {
  function update(patch: Partial<DosageAndStockFormValue>): void {
    onChange({ ...value, ...patch });
  }

  return (
    <View style={styles.container}>
      <AccessibleText variant="label" bold>
        Horario y dosis
      </AccessibleText>

      <View style={styles.row}>
        <Field label="Hora" value={value.timeHour} onChangeText={(t) => update({ timeHour: t })} keyboardType="number-pad" maxLength={2} />
        <Field label="Minuto" value={value.timeMinute} onChangeText={(t) => update({ timeMinute: t })} keyboardType="number-pad" maxLength={2} />
      </View>

      <View style={styles.row}>
        <Field
          label="Cantidad por toma"
          value={value.dosageAmount}
          onChangeText={(t) => update({ dosageAmount: t })}
          keyboardType="decimal-pad"
        />
      </View>

      <AccessibleText variant="label" bold style={styles.sectionSpacing}>
        ¿Cuándo empieza?
      </AccessibleText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {START_OFFSETS.map((offset) => (
          <Chip
            key={offset}
            label={formatStartDayLabel(new Date(), offset)}
            selected={value.startOffsetDays === offset}
            onPress={() => update({ startOffsetDays: offset })}
          />
        ))}
      </ScrollView>

      <AccessibleText variant="label" bold style={styles.sectionSpacing}>
        ¿Por cuánto tiempo?
      </AccessibleText>
      {/* Por duración y no por fecha de calendario: las indicaciones se
          escriben así ("tomar por 7 días") y nadie tiene que calcular en qué
          día cae el final, que es donde se cuelan los errores. */}
      <View style={styles.chipRow}>
        {DURATIONS.map(({ label, days }) => (
          <Chip
            key={label}
            label={label}
            selected={value.durationDays === days}
            onPress={() => update({ durationDays: days })}
          />
        ))}
      </View>

      <AccessibleText variant="small" color={colors.textSecondary}>
        {formatTreatmentPeriod(new Date(), value.startOffsetDays, value.durationDays)}
      </AccessibleText>

      <AccessibleText variant="small" color={colors.textSecondary} style={styles.sectionSpacing}>
        ¿Qué días toma este medicamento?
      </AccessibleText>
      <Pressable
        onPress={() => update({ allDays: !value.allDays })}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: value.allDays }}
        accessibilityLabel="Todos los días"
        style={styles.allDaysRow}
      >
        <View style={[styles.checkbox, value.allDays && styles.checkboxChecked]}>
          {value.allDays ? (
            <AccessibleText variant="small" bold color="#FFFFFF">
              ✓
            </AccessibleText>
          ) : null}
        </View>
        <AccessibleText variant="body">Todos los días</AccessibleText>
      </Pressable>

      {!value.allDays ? (
        <View>
          <View style={styles.chipRow}>
            {DIAS.map((dia) => (
              <DayChip
                key={dia.value}
                dia={dia}
                selected={value.weekdays.includes(dia.value)}
                onPress={() => update({ weekdays: toggleDay(value.weekdays, dia.value) })}
              />
            ))}
          </View>
          {value.weekdays.length === 0 ? (
            // Sin esto el botón de guardar queda deshabilitado sin decir por
            // qué, que es el callejón sin salida que tenía la versión vieja.
            <AccessibleText variant="small" bold color={colors.warning}>
              Elegí al menos un día.
            </AccessibleText>
          ) : null}
        </View>
      ) : null}

      <AccessibleText variant="label" bold style={styles.sectionSpacing}>
        Stock inicial
      </AccessibleText>

      <View style={styles.row}>
        <Field
          label="Cantidad disponible"
          value={value.initialStock}
          onChangeText={(t) => update({ initialStock: t })}
          keyboardType="decimal-pad"
        />
        <Field
          label="Consumo diario"
          value={value.dailyConsumption}
          onChangeText={(t) => update({ dailyConsumption: t })}
          keyboardType="decimal-pad"
        />
      </View>
    </View>
  );
}

/** Inmutable y ordenado: el orden estable hace que dos esquemas iguales se vean iguales. */
function toggleDay(weekdays: readonly number[], day: number): readonly number[] {
  return weekdays.includes(day)
    ? weekdays.filter((d) => d !== day)
    : [...weekdays, day].sort((a, b) => a - b);
}

interface DayChipProps {
  readonly dia: { readonly value: number; readonly corto: string; readonly largo: string };
  readonly selected: boolean;
  readonly onPress: () => void;
}

/**
 * Hermano del `Chip` de abajo, pero de selección MÚLTIPLE — de ahí
 * `accessibilityRole="checkbox"` y no `radio`: un lector de pantalla tiene
 * que anunciar "Martes, casilla, marcada", no tratarlos como opciones
 * excluyentes.
 *
 * La etiqueta visible es una sola letra porque entran siete en el ancho de
 * un teléfono, pero la etiqueta ACCESIBLE dice el día completo: "M" a secas
 * no distingue martes de miércoles, ni leído ni mirado. Por eso el
 * seleccionado además lleva borde y negrita, nunca solo el color.
 */
function DayChip({ dia, selected, onPress }: DayChipProps): React.JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={dia.largo}
      style={[styles.chip, styles.dayChip, selected && styles.chipSelected]}
    >
      <AccessibleText variant="small" bold color={selected ? '#FFFFFF' : colors.textPrimary}>
        {dia.corto}
      </AccessibleText>
    </Pressable>
  );
}

interface ChipProps {
  readonly label: string;
  readonly selected: boolean;
  readonly onPress: () => void;
}

/** Seleccionado se distingue por BORDE y peso además del color de fondo — nunca solo por color. */
function Chip({ label, selected, onPress }: ChipProps): React.JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <AccessibleText variant="small" bold={selected} color={selected ? '#FFFFFF' : colors.textPrimary}>
        {label}
      </AccessibleText>
    </Pressable>
  );
}

interface FieldProps {
  readonly label: string;
  readonly value: string;
  readonly onChangeText: (text: string) => void;
  readonly keyboardType?: 'number-pad' | 'decimal-pad';
  readonly maxLength?: number;
}

function Field({ label, value, onChangeText, keyboardType, maxLength }: FieldProps): React.JSX.Element {
  return (
    <View style={styles.field}>
      <AccessibleText variant="small" color={colors.textSecondary}>
        {label}
      </AccessibleText>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        maxLength={maxLength}
        accessibilityLabel={label}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingVertical: spacing.xs },
  chip: {
    minHeight: 48,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  dayChip: { minWidth: 48, alignItems: 'center', paddingHorizontal: spacing.sm },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark,
  },
  container: { gap: spacing.sm },
  sectionSpacing: { marginTop: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md },
  field: { flex: 1, gap: spacing.xs },
  input: {
    minHeight: touchTarget.minHeight,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    fontSize: typography.body,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
  allDaysRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: touchTarget.minHeight,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: radii.sm,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
});

export { MeasurementUnit };
