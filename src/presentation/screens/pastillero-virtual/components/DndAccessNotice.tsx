import React from 'react';
import { View, StyleSheet } from 'react-native';
import { AccessibleText } from '../../../design-system/AccessibleText';
import { AccessibleButton } from '../../../design-system/AccessibleButton';
import { colors, radii, spacing } from '../../../design-system/tokens';

export interface DndAccessNoticeProps {
  readonly onOpenSettings: () => void;
}

/**
 * Aparece SOLO cuando el dispositivo confirma que la alarma de toma no
 * suena con el teléfono en No Molestar. No es un aviso preventivo ni una
 * recomendación: es la única forma de arreglarlo, porque "Acceso a No
 * molestar" no tiene diálogo de permiso — se concede a mano en los ajustes
 * del sistema y nada más.
 *
 * El texto no dice "No molestar" ni "permiso": dice lo que pasa y lo que
 * hay que hacer. Quien lo lee puede no saber que tiene el modo activado,
 * ni qué es un canal de notificación.
 */
export function DndAccessNotice({ onOpenSettings }: DndAccessNoticeProps): React.JSX.Element {
  return (
    <View style={styles.container} accessible accessibilityLiveRegion="polite">
      <AccessibleText variant="small" color={colors.warning} bold style={styles.text}>
        Si el teléfono está en silencio, la alarma no va a sonar. Se arregla una sola vez.
      </AccessibleText>
      <AccessibleButton label="Que suene siempre" variant="secondary" onPress={onOpenSettings} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.warningBackground,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: '#FED7AA',
    padding: spacing.md,
    gap: spacing.sm,
  },
  text: { textAlign: 'center' },
});
