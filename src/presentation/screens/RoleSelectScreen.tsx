import React from 'react';
import { View, StyleSheet } from 'react-native';
import { AccessibleText } from '../design-system/AccessibleText';
import { AccessibleButton } from '../design-system/AccessibleButton';
import { colors, spacing } from '../design-system/tokens';
import { useSession } from '../providers/SessionContext';

/** Reemplazar por el flujo real de login/onboarding — ver nota en SessionContext. */
export function RoleSelectScreen(): React.JSX.Element {
  const { setRole } = useSession();

  return (
    <View style={styles.container}>
      <AccessibleText variant="title" bold style={styles.text}>
        ¿Quién va a usar la aplicación?
      </AccessibleText>
      <View style={styles.buttons}>
        <AccessibleButton label="Soy el Adulto Mayor" onPress={() => setRole('ADULTO_MAYOR')} fullHeight />
        <AccessibleButton
          label="Soy el Cuidador"
          variant="secondary"
          onPress={() => setRole('CUIDADOR')}
          fullHeight
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.xl,
    justifyContent: 'center',
    gap: spacing.xl,
  },
  text: {
    textAlign: 'center',
  },
  buttons: {
    gap: spacing.md,
  },
});
