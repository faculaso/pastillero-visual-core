import React from 'react';
import { View, StyleSheet } from 'react-native';
import { AccessibleText } from '../../../design-system/AccessibleText';
import { AccessibleButton } from '../../../design-system/AccessibleButton';
import { colors, radii, spacing } from '../../../design-system/tokens';

export interface StockNoticeBannerProps {
  readonly message: string;
  readonly onDismiss: () => void;
}

/**
 * Hermano NO bloqueante de `ErrorBanner`. La diferencia importa: un error
 * reemplaza el botón de confirmar porque hay algo que reintentar; acá la
 * toma YA quedó registrada y lo único que falta es que alguien reponga el
 * remedio. Por eso convive con el botón en vez de taparlo, usa el tono de
 * advertencia y no el crítico, y se anuncia en modo `polite`: no hay que
 * interrumpir a nadie con esto.
 */
export function StockNoticeBanner({ message, onDismiss }: StockNoticeBannerProps): React.JSX.Element {
  return (
    <View style={styles.container} accessible accessibilityLiveRegion="polite">
      <AccessibleText variant="small" color={colors.warning} bold style={styles.text}>
        {message}
      </AccessibleText>
      <AccessibleButton label="Entendido" variant="secondary" onPress={onDismiss} />
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
