import React, { useState } from 'react';
import { View, TextInput, StyleSheet } from 'react-native';
import { AccessibleText } from '../../../design-system/AccessibleText';
import { AccessibleButton } from '../../../design-system/AccessibleButton';
import type { MeasurementUnit } from '../../../../domain';
import { colors, radii, spacing, touchTarget, typography } from '../../../design-system/tokens';
import { formatQuantityWithUnit } from '../../../utils/format-dosage-label';

export interface UpdateStockFormProps {
  readonly loading: boolean;
  /** Cuánto hay HOY — sin esto se pedía un número absoluto a ciegas. */
  readonly currentQuantity: number;
  readonly unit: MeasurementUnit;
  readonly onSubmit: (newQuantity: number) => void;
}

/** CU-03 paso 5: "El Cuidador compra la medicación y pulsa Actualizar Stock". */
export function UpdateStockForm({
  loading,
  currentQuantity,
  unit,
  onSubmit,
}: UpdateStockFormProps): React.JSX.Element {
  const [value, setValue] = useState('');
  const parsed = Number(value);
  const isValid = value.trim().length > 0 && Number.isFinite(parsed) && parsed >= 0;
  const actual = formatQuantityWithUnit(currentQuantity, unit);

  return (
    <View style={styles.container}>
      <AccessibleText variant="label" bold>
        Actualizar stock
      </AccessibleText>
      {/* Decir cuánto hay y en qué unidad: el campo pide un TOTAL nuevo, no
          lo que se acaba de comprar, y sin el valor actual a la vista esa
          distinción es imposible de adivinar. */}
      <AccessibleText variant="small" color={colors.textSecondary}>
        Ahora hay {actual}. Escribí cuánto queda en total después de reponer.
      </AccessibleText>
      <View style={styles.row}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={setValue}
          keyboardType="decimal-pad"
          placeholder={`Total en ${formatQuantityWithUnit(2, unit).split(' ')[1]}`}
          placeholderTextColor={colors.textSecondary}
          accessibilityLabel={`Nueva cantidad total de stock. Ahora hay ${actual}`}
        />
        <AccessibleButton
          label="Guardar"
          onPress={() => onSubmit(parsed)}
          disabled={!isValid}
          loading={loading}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  input: {
    flex: 1,
    minHeight: touchTarget.minHeight,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    fontSize: typography.body,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
});
