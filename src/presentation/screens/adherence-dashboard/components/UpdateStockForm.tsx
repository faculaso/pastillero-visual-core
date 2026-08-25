import React, { useState } from 'react';
import { View, TextInput, StyleSheet } from 'react-native';
import { AccessibleText } from '../../../design-system/AccessibleText';
import { AccessibleButton } from '../../../design-system/AccessibleButton';
import { colors, radii, spacing, touchTarget, typography } from '../../../design-system/tokens';

export interface UpdateStockFormProps {
  readonly loading: boolean;
  readonly onSubmit: (newQuantity: number) => void;
}

/** CU-03 paso 5: "El Cuidador compra la medicación y pulsa Actualizar Stock". */
export function UpdateStockForm({ loading, onSubmit }: UpdateStockFormProps): React.JSX.Element {
  const [value, setValue] = useState('');
  const parsed = Number(value);
  const isValid = value.trim().length > 0 && Number.isFinite(parsed) && parsed >= 0;

  return (
    <View style={styles.container}>
      <AccessibleText variant="label" bold>
        Actualizar stock
      </AccessibleText>
      <View style={styles.row}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={setValue}
          keyboardType="decimal-pad"
          placeholder="Cantidad nueva"
          placeholderTextColor={colors.textSecondary}
          accessibilityLabel="Nueva cantidad de stock disponible"
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
