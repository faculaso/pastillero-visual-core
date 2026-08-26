import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, TextInput, View, type KeyboardTypeOptions, type TextInputProps } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { AccessibleText } from '../../../design-system/AccessibleText';
import { colors, radii, spacing, touchTarget, typography } from '../../../design-system/tokens';
import { authPalette } from '../theme/auth-theme';
import { useShake } from '../../../hooks/useShake';
import { useStaggeredEntrance } from '../../../hooks/useStaggeredEntrance';

export interface AuthTextFieldProps {
  readonly label: string;
  readonly value: string;
  readonly onChangeText: (text: string) => void;
  readonly accessibilityLabel?: string;
  readonly placeholder?: string;
  readonly secureTextEntry?: boolean;
  readonly keyboardType?: KeyboardTypeOptions;
  readonly autoCapitalize?: TextInputProps['autoCapitalize'];
  readonly returnKeyType?: TextInputProps['returnKeyType'];
  readonly onSubmitEditing?: () => void;
  /** Presencia (no el texto) dispara la micro-sacudida y el borde en rojo — el mensaje en sí se muestra aparte, debajo del formulario. */
  readonly hasError?: boolean;
}

const FOCUS_TIMING = { duration: 180 };

/**
 * Input con label flotante (estilo Material, contenido DENTRO del borde
 * del campo para no romper `touchTarget.minHeight` de 72px del design
 * system): en reposo actúa como placeholder de tamaño legible; al enfocar
 * o tener contenido, sube y se achica encima del texto.
 */
export function AuthTextField({
  label,
  value,
  onChangeText,
  accessibilityLabel,
  placeholder,
  secureTextEntry,
  keyboardType,
  autoCapitalize = 'none',
  returnKeyType,
  onSubmitEditing,
  hasError = false,
}: AuthTextFieldProps): React.JSX.Element {
  const [isFocused, setIsFocused] = useState(false);
  const floated = isFocused || value.length > 0;

  const focusProgress = useSharedValue(0);
  const glowOpacity = useSharedValue(0);
  const { style: shakeStyle, trigger: triggerShake } = useShake();
  const wasError = useRef(false);

  useEffect(() => {
    focusProgress.value = withTiming(floated ? 1 : 0, FOCUS_TIMING);
  }, [floated, focusProgress]);

  useEffect(() => {
    glowOpacity.value = withTiming(isFocused ? 1 : 0, FOCUS_TIMING);
  }, [isFocused, glowOpacity]);

  useEffect(() => {
    if (hasError && !wasError.current) triggerShake();
    wasError.current = hasError;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasError]);

  const labelStyle = useAnimatedStyle(() => ({
    top: 24 - focusProgress.value * 14,
    fontSize: typography.body - focusProgress.value * (typography.body - typography.small),
  }));

  const glowStyle = useAnimatedStyle(() => ({ opacity: glowOpacity.value }));

  const entrance = useStaggeredEntrance(3);

  return (
    <Animated.View style={[styles.wrapper, entrance, shakeStyle]}>
      <View style={[styles.field, hasError && styles.fieldError]}>
        <Animated.View style={[styles.focusGlow, glowStyle]} pointerEvents="none" />
        <Animated.Text
          style={[styles.label, labelStyle, { color: hasError ? colors.critical : isFocused ? authPalette.clinicalBlue : colors.textSecondary }]}
          allowFontScaling
          maxFontSizeMultiplier={1.6}
        >
          {label}
        </Animated.Text>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={floated ? placeholder : undefined}
          placeholderTextColor={colors.textSecondary}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          accessibilityLabel={accessibilityLabel ?? label}
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 0 },
  field: {
    minHeight: touchTarget.minHeight,
    borderWidth: 2,
    borderColor: authPalette.inputIdleBorder,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    overflow: 'hidden',
  },
  fieldError: { borderColor: colors.critical },
  focusGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: authPalette.clinicalBlue,
  },
  label: { position: 'absolute', left: spacing.md, fontWeight: '600' },
  input: {
    fontSize: typography.body,
    color: colors.textPrimary,
    paddingTop: 34,
    paddingBottom: spacing.sm,
    minHeight: touchTarget.minHeight,
  },
});
