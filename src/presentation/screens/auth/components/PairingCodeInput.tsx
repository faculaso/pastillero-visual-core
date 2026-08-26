import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { AccessibleText } from '../../../design-system/AccessibleText';
import { colors, radii, spacing } from '../../../design-system/tokens';
import { authPalette } from '../theme/auth-theme';
import { vibrateSuccess } from '../../../utils/haptics';
import { useShake } from '../../../hooks/useShake';
import { useStaggeredEntrance } from '../../../hooks/useStaggeredEntrance';

export interface PairingCodeInputProps {
  readonly label: string;
  readonly value: string;
  readonly onChangeText: (text: string) => void;
  readonly accessibilityLabel?: string;
  readonly length?: number;
  readonly hasError?: boolean;
  readonly staggerIndex?: number;
  /** Se dispara UNA vez cuando se completan los `length` dígitos. */
  readonly onComplete?: () => void;
}

/**
 * Casilleros individuales de código de emparejamiento (invite code de 6
 * caracteres: `redeem-invite-code`, ver `SessionContext.linkPatient`). Por
 * debajo es UN solo `TextInput` real, transparente y superpuesto a la fila
 * de casilleros — más robusto que N `TextInput`s con foco manual encadenado
 * (sin bugs de autofill/teclado al saltar de campo) y compatible con
 * `userEvent.type()` de Testing Library, que simula tipeo sobre un único
 * input controlado.
 */
export function PairingCodeInput({
  label,
  value,
  onChangeText,
  accessibilityLabel,
  length = 6,
  hasError = false,
  staggerIndex = 4,
  onComplete,
}: PairingCodeInputProps): React.JSX.Element {
  const [isFocused, setIsFocused] = useState(false);
  const { style: shakeStyle, trigger: triggerShake } = useShake();
  const pulse = useSharedValue(1);
  const wasError = useRef(false);
  const wasComplete = useRef(false);
  const entrance = useStaggeredEntrance(staggerIndex);

  useEffect(() => {
    if (hasError && !wasError.current) triggerShake();
    wasError.current = hasError;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasError]);

  useEffect(() => {
    const isComplete = value.length >= length;
    if (isComplete && !wasComplete.current) {
      vibrateSuccess();
      pulse.value = withSequence(withTiming(1.06, { duration: 90 }), withTiming(1, { duration: 120 }));
      onComplete?.();
    }
    wasComplete.current = isComplete;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, length]);

  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));
  const activeIndex = Math.min(value.length, length - 1);

  return (
    <Animated.View style={[entrance, shakeStyle, styles.wrapper]}>
      <AccessibleText variant="small" bold color={colors.textSecondary}>
        {label}
      </AccessibleText>
      <View style={styles.fieldsContainer}>
        <Animated.View style={[styles.row, pulseStyle]}>
          {Array.from({ length }, (_, index) => {
            const char = value[index] ?? '';
            const isActive = isFocused && index === activeIndex;
            return (
              <View
                key={index}
                style={[
                  styles.box,
                  char.length > 0 && styles.boxFilled,
                  isActive && styles.boxActive,
                  hasError && styles.boxError,
                ]}
              >
                <AccessibleText variant="label" bold color={hasError ? colors.critical : authPalette.clinicalBlue}>
                  {char}
                </AccessibleText>
              </View>
            );
          })}
        </Animated.View>
        <TextInput
          value={value}
          onChangeText={(text) => onChangeText(text.toUpperCase().slice(0, length))}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={length}
          accessibilityLabel={accessibilityLabel ?? label}
          style={styles.hiddenInput}
        />
      </View>
    </Animated.View>
  );
}

const BOX_SIZE = 48;

const styles = StyleSheet.create({
  wrapper: { gap: spacing.sm },
  fieldsContainer: { position: 'relative' },
  row: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'center' },
  box: {
    width: BOX_SIZE,
    height: 60,
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: authPalette.inputIdleBorder,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxFilled: { borderColor: authPalette.inputFilledBorder, backgroundColor: authPalette.glowSoft },
  boxActive: {
    borderColor: authPalette.clinicalBlueLight,
    shadowColor: authPalette.clinicalBlueLight,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 6,
    elevation: 3,
  },
  boxError: { borderColor: colors.critical, backgroundColor: colors.criticalBackground },
  hiddenInput: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0 },
});
