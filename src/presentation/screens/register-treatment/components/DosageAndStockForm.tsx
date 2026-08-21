import React from 'react';
import { View, TextInput, StyleSheet } from 'react-native';
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
}

export interface DosageAndStockFormProps {
  readonly value: DosageAndStockFormValue;
  readonly onChange: (value: DosageAndStockFormValue) => void;
}

/**
 * CU-01 paso 8 (RF-01, RF-05). Simplificación MVP deliberada: un único
 * horario diario (`DosageFrequency.DAILY`) en vez de exponer las 4
 * frecuencias del dominio en la UI — el use case y el dominio ya soportan
 * todas, esto es solo una decisión de superficie de formulario para el
 * primer corte; agregar el selector de frecuencia es la extensión natural.
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
    backgroundColor: colors.background,
  },
});

export { MeasurementUnit };
