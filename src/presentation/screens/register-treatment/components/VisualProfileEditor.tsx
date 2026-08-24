import React, { useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Circle } from 'react-native-svg';
import { PillShape } from '../../../../domain';
import { AccessibleText } from '../../../design-system/AccessibleText';
import { colors, radii, spacing, touchTarget } from '../../../design-system/tokens';
import { PillVisual } from '../../pastillero-virtual/components/PillVisual';
import { BoxPhotoCaptureField } from './BoxPhotoCaptureField';
import { ColorWheelPicker } from './ColorWheelPicker';
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

const COLOR_SWATCHES: ReadonlyArray<{ readonly hex: string; readonly label: string }> = [
  { hex: '#EB5757', label: 'Rojo' },
  { hex: '#2D9CDB', label: 'Azul' },
  { hex: '#F2C94C', label: 'Amarillo' },
  { hex: '#27AE60', label: 'Verde' },
  { hex: '#FFFFFF', label: 'Blanco' },
  { hex: '#9B51E0', label: 'Violeta' },
];

/** Mismos turnos que `getTimeOfDayTheme` (mañana/tarde/noche) — la ranura es por turno, no texto libre. */
const SLOT_OPTIONS: ReadonlyArray<string> = ['Mañana', 'Tarde', 'Noche'];

/**
 * CU-01 pasos 6-7 / RF-02. La preview usa el mismo `PillVisual` que ve el
 * Adulto Mayor en CU-02: "lo que configurás es lo que él va a ver" — captura
 * la foto real (`BoxPhotoCaptureField`) y la reflejás inmediatamente en la
 * misma preview de la que depende el reconocimiento visual en CU-02.
 */
export function VisualProfileEditor({ value, onChange }: VisualProfileEditorProps): React.JSX.Element {
  const [showFullPicker, setShowFullPicker] = useState(false);

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
        Color — tocá para pintar la pastilla
      </AccessibleText>
      <View style={styles.colorRow}>
        {COLOR_SWATCHES.map(({ hex, label }) => (
          <Pressable
            key={hex}
            onPress={() => update({ color: hex })}
            accessibilityRole="radio"
            accessibilityState={{ checked: value.color === hex }}
            accessibilityLabel={label}
            style={[
              styles.swatch,
              { backgroundColor: hex },
              value.color === hex && styles.swatchSelected,
            ]}
          >
            {value.color === hex ? (
              <AccessibleText variant="label" bold color={hex === '#FFFFFF' || hex === '#F2C94C' ? colors.textPrimary : '#FFFFFF'}>
                ✓
              </AccessibleText>
            ) : null}
          </Pressable>
        ))}

        <Pressable
          onPress={() => setShowFullPicker((current) => !current)}
          accessibilityRole="button"
          accessibilityState={{ expanded: showFullPicker }}
          accessibilityLabel="Más colores"
          style={[styles.swatch, showFullPicker && styles.swatchSelected]}
        >
          <Svg width={touchTarget.minWidth - 4} height={touchTarget.minHeight - 4}>
            <Defs>
              <LinearGradient id="rainbowSwatch" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor="#EB5757" stopOpacity={1} />
                <Stop offset="0.2" stopColor="#F2C94C" stopOpacity={1} />
                <Stop offset="0.4" stopColor="#27AE60" stopOpacity={1} />
                <Stop offset="0.6" stopColor="#2D9CDB" stopOpacity={1} />
                <Stop offset="0.8" stopColor="#9B51E0" stopOpacity={1} />
                <Stop offset="1" stopColor="#EB5757" stopOpacity={1} />
              </LinearGradient>
            </Defs>
            <Circle
              cx={(touchTarget.minWidth - 4) / 2}
              cy={(touchTarget.minHeight - 4) / 2}
              r={(touchTarget.minWidth - 4) / 2}
              fill="url(#rainbowSwatch)"
            />
          </Svg>
        </Pressable>
      </View>

      {showFullPicker ? (
        <ColorWheelPicker value={value.color} onChange={(color) => update({ color })} />
      ) : null}

      <AccessibleText variant="small" color={colors.textSecondary}>
        Ranura del pastillero (opcional)
      </AccessibleText>
      <View style={styles.shapeRow}>
        {SLOT_OPTIONS.map((slot) => (
          <Pressable
            key={slot}
            onPress={() => update({ slotLabel: value.slotLabel === slot ? '' : slot })}
            accessibilityRole="radio"
            accessibilityState={{ checked: value.slotLabel === slot }}
            accessibilityLabel={slot}
            style={[styles.shapeChip, value.slotLabel === slot && styles.shapeChipSelected]}
          >
            <AccessibleText
              variant="small"
              color={value.slotLabel === slot ? '#FFFFFF' : colors.textPrimary}
              bold={value.slotLabel === slot}
            >
              {slot}
            </AccessibleText>
          </Pressable>
        ))}
      </View>

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
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchSelected: {
    borderColor: colors.primary,
    borderWidth: 4,
  },
});
