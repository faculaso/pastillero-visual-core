import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { AccessibleText } from '../../../design-system/AccessibleText';
import { colors, radii, spacing, touchTarget } from '../../../design-system/tokens';
import type { TimeOfDayTheme } from '../../../utils/time-of-day-theme';

export interface InviteCodeButtonProps {
  readonly onPress: () => void;
  /** Tema del turno: el botón vive sobre el fondo teñido, no sobre una tarjeta blanca. */
  readonly theme?: TimeOfDayTheme | null;
}

/**
 * Era un modal que mostraba EL código (uno solo, de solo lectura). Ahora
 * abre `MisCuidadoresScreen`: con hasta tres códigos, la posibilidad de
 * darlos de baja y la lista de quién te cuida, ya no entra en una ventanita
 * — y menos en la de alguien que necesita texto grande.
 */
export function InviteCodeButton({ onPress, theme }: InviteCodeButtonProps): React.JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Mi código y quién me cuida"
      hitSlop={8}
      style={({ pressed }) => [
        styles.button,
        theme ? { backgroundColor: theme.chipBackground, borderColor: theme.chipBorder } : null,
        pressed && styles.buttonPressed,
      ]}
    >
      <AccessibleText variant="small" bold color={theme?.accentText ?? colors.textSecondary}>
        Mi código
      </AccessibleText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    // El target de 72px ya existía, pero era INVISIBLE: tres rótulos de
    // texto flotando dejaban una banda vacía arriba de la pantalla que se
    // leía como un error de layout, y nada indicaba dónde tocar. Con
    // superficie propia la misma altura pasa a leerse como una botonera.
    flex: 1,
    minHeight: touchTarget.minHeight,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  buttonPressed: {
    backgroundColor: 'rgba(15, 23, 42, 0.06)',
  },
});
