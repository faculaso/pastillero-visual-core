import React, { useState } from 'react';
import { View, TextInput, StyleSheet, ScrollView } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/types';
import { useSession } from '../../providers/SessionContext';
import { AccessibleText } from '../../design-system/AccessibleText';
import { AccessibleButton } from '../../design-system/AccessibleButton';
import { colors, radii, spacing, touchTarget, typography } from '../../design-system/tokens';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignIn'>;

function describeSignInError(code: string | undefined): string {
  if (code === 'AUTH_INVALID_CREDENTIALS') return 'Correo o contraseña incorrectos.';
  return 'No pudimos iniciar sesión. Intentá de nuevo.';
}

export function SignInScreen({ navigation }: Props): React.JSX.Element {
  const { signIn } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(): Promise<void> {
    setStatus('submitting');
    setError(null);
    const result = await signIn(email.trim(), password);
    if (!result.ok) {
      setStatus('error');
      setError(describeSignInError(result.errorCode));
      return;
    }
    // Sesión resuelta: `RootNavigator` cambia de stack solo apenas `useSession().session` deja de ser null.
    setStatus('idle');
  }

  const canSubmit = email.trim().length > 0 && password.length > 0 && status !== 'submitting';

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <AccessibleText variant="title" bold style={styles.title}>
        Iniciar sesión
      </AccessibleText>

      <View style={styles.field}>
        <AccessibleText variant="small" bold color={colors.textSecondary}>
          Correo electrónico
        </AccessibleText>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="tu@email.com"
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="none"
          keyboardType="email-address"
          accessibilityLabel="Correo electrónico"
        />
      </View>

      <View style={styles.field}>
        <AccessibleText variant="small" bold color={colors.textSecondary}>
          Contraseña
        </AccessibleText>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          placeholderTextColor={colors.textSecondary}
          secureTextEntry
          accessibilityLabel="Contraseña"
        />
      </View>

      {error ? (
        <AccessibleText color={colors.critical} bold style={styles.error}>
          {error}
        </AccessibleText>
      ) : null}

      <AccessibleButton
        label="Iniciar sesión"
        onPress={handleSubmit}
        disabled={!canSubmit}
        loading={status === 'submitting'}
        fullHeight
      />

      <View style={styles.footerRow}>
        <AccessibleText variant="small" color={colors.textSecondary}>
          ¿No tenés cuenta?
        </AccessibleText>
        <AccessibleButton label="Creá una" variant="secondary" onPress={() => navigation.navigate('SignUp')} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  title: { textAlign: 'center' },
  field: { gap: spacing.sm },
  input: {
    minHeight: touchTarget.minHeight,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    fontSize: typography.body,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
  error: { textAlign: 'center' },
  footerRow: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
});
