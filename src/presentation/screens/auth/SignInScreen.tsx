import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/types';
import { useSession } from '../../providers/SessionContext';
import { AccessibleText } from '../../design-system/AccessibleText';
import { AccessibleButton } from '../../design-system/AccessibleButton';
import { colors, spacing } from '../../design-system/tokens';
import { AuthGradientBackground } from './components/AuthGradientBackground';
import { AuthBrandHeader } from './components/AuthBrandHeader';
import { AuthCard } from './components/AuthCard';
import { AuthTextField } from './components/AuthTextField';
import { PrimaryAuthButton } from './components/PrimaryAuthButton';
import { useStaggeredEntrance } from '../../hooks/useStaggeredEntrance';

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
  const footerEntrance = useStaggeredEntrance(6);

  return (
    <View style={styles.screen}>
      <AuthGradientBackground />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <AuthBrandHeader title="Pastillero Visual" subtitle="Iniciá sesión para continuar tu cuidado" />

          <AuthCard staggerIndex={2}>
            <AuthTextField
              label="Correo electrónico"
              value={email}
              onChangeText={setEmail}
              placeholder="tu@email.com"
              keyboardType="email-address"
              hasError={status === 'error'}
            />
            <AuthTextField
              label="Contraseña"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              hasError={status === 'error'}
            />

            {error ? (
              <AccessibleText color={colors.critical} bold style={styles.centerText}>
                {error}
              </AccessibleText>
            ) : null}

            <PrimaryAuthButton
              label="Iniciar sesión"
              onPress={handleSubmit}
              disabled={!canSubmit}
              loading={status === 'submitting'}
            />
          </AuthCard>

          <Animated.View style={[styles.footerRow, footerEntrance]}>
            <AccessibleText variant="small" color={colors.textSecondary}>
              ¿No tenés cuenta?
            </AccessibleText>
            <AccessibleButton label="Creá una" variant="secondary" onPress={() => navigation.navigate('SignUp')} />
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F0F9FF' },
  flex: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl, flexGrow: 1, justifyContent: 'center' },
  centerText: { textAlign: 'center' },
  footerRow: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
});
