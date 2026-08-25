import React from 'react';
import { View, TextInput, Pressable, StyleSheet } from 'react-native';
import { MeasurementUnit } from '../../../../domain';
import { AccessibleText } from '../../../design-system/AccessibleText';
import { colors, radii, spacing, touchTarget, typography } from '../../../design-system/tokens';

export interface DosageAndStockFormValue {
  readonly timeHour: string;
  readonly timeMinute: string;
  readonly dosageAmount: string;
  readonly dosageUnit: MeasurementUnit;
  readonly initialStock: string;
  readonly dailyConsumption: string;
  readonly allDays: boolean;
  /** 0(dom)-6(sáb). Solo se usa cuando `allDays` es `false`. */
  readonly weekdays: readonly number[];
}

export interface DosageAndStockFormProps {
  readonly value: DosageAndStockFormValue;
  readonly onChange: (value: DosageAndStockFormValue) => void;
}

/**
 * CU-01 paso 8 (RF-01, RF-05). Simplificación MVP deliberada: por ahora el
 * checkbox "Todos los días" solo cubre el caso DAILY — destildarlo NO
 * muestra un selector de días sueltos (a pedido explícito: se probaron un
 * par de variantes de esa UI y ninguna terminó de andar bien), así que
 * `weekdays` queda sin una forma de cargarse todavía. Si el negocio necesita
 * SPECIFIC_WEEKDAYS de nuevo, hay que sumarle una UI a esta sección.
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
