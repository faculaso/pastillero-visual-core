import React from 'react';
import { View, Modal, Pressable, StyleSheet } from 'react-native';
import { AccessibleText } from './AccessibleText';
import { AccessibleButton, type AccessibleButtonVariant } from './AccessibleButton';
import { colors, radii, spacing, shadows } from './tokens';

export interface AppDialogAction {
  readonly label: string;
  readonly onPress: () => void;
  readonly variant?: AccessibleButtonVariant;
}

export interface AppDialogProps {
  readonly visible: boolean;
  readonly title: string;
  readonly message?: string;
  /** En orden de arriba hacia abajo. La salida ("Cancelar") va última, como en `WeekCellDetailModal`. */
  readonly actions: readonly AppDialogAction[];
  /** Tocar afuera o el botón "atrás" de Android. */
  readonly onDismiss: () => void;
}

/**
 * Los carteles de confirmación de la app. Reemplazan a `Alert.alert`, que
 * dibuja el diálogo nativo de Android: fondo gris, tipografía del sistema y
 * acciones como texto chico al pie, todo ajeno al resto de la app.
 *
 * Además del look, el problema era de accesibilidad: los botones del diálogo
 * nativo son texto, de unos 48px de alto y pegados entre sí. Toda la app está
 * construida sobre `touchTarget.minHeight` (72px) porque el usuario es un
 * Adulto Mayor — y justo los carteles que preguntan "¿querés dar esto de
 * baja?" eran lo más chico y lo más difícil de acertar de la pantalla.
 *
 * Acá las acciones son botones llenos, apilados, del alto de siempre.
 */
export function AppDialog({
  visible,
  title,
  message,
  actions,
  onDismiss,
}: AppDialogProps): React.JSX.Element {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <Pressable style={styles.overlay} onPress={onDismiss} accessibilityLabel="Cerrar el cartel">
        {/* `accessibilityViewIsModal` le esconde al lector de pantalla lo que
            quedó atrás, que es lo que el diálogo nativo hacía solo. */}
        <Pressable
          style={styles.card}
          onPress={(e) => e.stopPropagation()}
          accessibilityViewIsModal
          accessibilityRole="alert"
        >
          <AccessibleText variant="label" bold>
            {title}
          </AccessibleText>

          {message ? (
            <AccessibleText variant="body" color={colors.textSecondary}>
              {message}
            </AccessibleText>
          ) : null}

          <View style={styles.actions}>
            {actions.map((action) => (
              <AccessibleButton
                key={action.label}
                label={action.label}
                variant={action.variant ?? 'primary'}
                onPress={action.onPress}
              />
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.card,
  },
  actions: { gap: spacing.sm },
});
