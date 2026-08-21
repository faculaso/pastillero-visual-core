import React from 'react';
import { View, TextInput, Pressable, StyleSheet } from 'react-native';
import { PillShape } from '../../../../domain';
import { AccessibleText } from '../../../design-system/AccessibleText';
import { colors, radii, spacing, touchTarget, typography } from '../../../design-system/tokens';
import { PillVisual } from '../../pastillero-virtual/components/PillVisual';
import { BoxPhotoCaptureField } from './BoxPhotoCaptureField';
import { PILL_SHAPE_LABELS } from '../../../utils/pill-shape-labels';

export interface VisualProfileFormValue {
  readonly shape: PillShape;
  readonly color: string;
  readonly slotLabel: string;
  readonly pillImageUrl: string;
  readonly boxImageUrl: string;
}

export interface VisualProfileEditorProps {
  readonly value: VisualProfileFormValue;
  readonly onChange: (value: VisualProfileFormValue) => void;
}

const COLOR_SWATCHES = ['#FFFFFF', '#F2C94C', '#EB5757', '#2D9CDB', '#27AE60', '#9B51E0', '#F2994A', '#4A4A4A'];

/**
 * CU-01 pasos 6-7 / RF-02. La preview usa el mismo `PillVisual` que ve el
 * Adulto Mayor en CU-02: "lo que configurás es lo que él va a ver" — captura
 * la foto real (`BoxPhotoCaptureField`) y la reflejás inmediatamente en la
 * misma preview de la que depende el reconocimiento visual en CU-02.
 */
export function VisualProfileEditor({ value, onChange }: VisualProfileEditorProps): React.JSX.Element {
  function update(patch: Partial<VisualProfileFormValue>): void {
    onChange({ ...value, ...patch });
  }

  return (
    <View style={styles.container}>
      <AccessibleText variant="label" bold>
        Apariencia del comprimido
      </AccessibleText>

      <View style={styles.previewRow}>
        <PillVisual
          visualProfile={{
            shape: value.shape,
            color: value.color,
            pillImageUrl: value.pillImageUrl || undefined,
            boxImageUrl: value.boxImageUrl || undefined,
            slotLabel: value.slotLabel || undefined,
          }}
          size={120}
        />
      </View>

      <AccessibleText variant="small" color={colors.textSecondary}>
        Forma
      </AccessibleText>
      <View style={styles.shapeRow}>
        {Object.values(PillShape).map((shape) => (
          <Pressable
            key={shape}
            onPress={() => update({ shape })}
            accessibilityRole="radio"
            accessibilityState={{ checked: value.shape === shape }}
            accessibilityLabel={PILL_SHAPE_LABELS[shape]}
            style={[styles.shapeChip, value.shape === shape && styles.shapeChipSelected]}
          >
            <AccessibleText
              variant="small"
              color={value.shape === shape ? '#FFFFFF' : colors.textPrimary}
              bold={value.shape === shape}
            >
              {PILL_SHAPE_LABELS[shape]}
            </AccessibleText>
          </Pressable>
        ))}
      </View>

      <AccessibleText variant="small" color={colors.textSecondary}>
        Color
      </AccessibleText>
      <View style={styles.colorRow}>
        {COLOR_SWATCHES.map((color) => (
          <Pressable
            key={color}
            onPress={() => update({ color })}
            accessibilityRole="radio"
            accessibilityState={{ checked: value.color === color }}
            accessibilityLabel={`Color ${color}`}
            style={[
              styles.swatch,
              { backgroundColor: color },
              value.color === color && styles.swatchSelected,
            ]}
          />
        ))}
      </View>

      <AccessibleText variant="small" color={colors.textSecondary}>
        Ranura del pastillero (opcional)
      </AccessibleText>
      <TextInput
        style={styles.input}
        value={value.slotLabel}
        onChangeText={(slotLabel) => update({ slotLabel })}
        placeholder="Ej: Mañana - Ranura 1"
        placeholderTextColor={colors.textSecondary}
        accessibilityLabel="Ranura del pastillero"
      />

      <BoxPhotoCaptureField imageUri={value.boxImageUrl} onImageChange={(boxImageUrl) => update({ boxImageUrl })} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  previewRow: { alignItems: 'center', paddingVertical: spacing.md },
  shapeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  shapeChip: {
    minHeight: touchTarget.minHeight,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  shapeChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  swatch: {
    width: touchTarget.minWidth,
    height: touchTarget.minHeight,
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: colors.border,
  },
  swatchSelected: {
    borderColor: colors.primary,
    borderWidth: 4,
  },
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
