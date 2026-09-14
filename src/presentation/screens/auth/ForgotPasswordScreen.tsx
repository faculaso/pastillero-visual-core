import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/types';
import { useSession } from '../../providers/SessionContext';
import { AccessibleText } from '../../design-system/AccessibleText';
import { colors, spacing } from '../../design-system/tokens';
import { AuthGradientBackground } from './components/AuthGradientBackground';
import { AuthBrandHeader } from './components/AuthBrandHeader';
import { AuthCard } from './components/AuthCard';
import { AuthTextField } from './components/AuthTextField';
import { PrimaryAuthButton } from './components/PrimaryAuthButton';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

/**
 * Solo dispara el email de recuperación de Supabase Auth — no hay pantalla
 * de "elegir nueva contraseña" acá porque completar el reset requiere un
 * deep link de vuelta a la app (`redirectTo` + manejo de `Linking`), fuera
 * de alcance de esta feature. El usuario termina el flujo en el link que le
 * llega por correo y vuelve a `SignIn` con la contraseña nueva.
 */
export function ForgotPasswordScreen({ navigation }: Props): React.JSX.Element {
  const { requestPasswordReset } = useSession();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'error' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(): Promise<void> {
    setStatus('submitting');
    setError(null);
    const result = await requestPasswordReset(email.trim());
    if (!result.ok) {
      setStatus('error');
      setError('No pudimos enviar el correo. Intentá de nuevo.');
      return;
    }
    setStatus('sent');
  }

  const canSubmit = email.trim().length > 0 && status !== 'submitting';

  if (status === 'sent') {
    return (
      <View style={styles.screen}>
        <AuthGradientBackground />
        <View style={styles.centered}>
          <AuthCard staggerIndex={0}>
            <AccessibleText variant="title" bold style={styles.centerText}>
              Revisá tu correo
            </AccessibleText>
            <AccessibleText variant="body" color={colors.textSecondary} style={styles.centerText}>
              Si {email.trim()} tiene una cuenta, te mandamos un enlace para elegir una contraseña nueva.
            </AccessibleText>
            <PrimaryAuthButton label="Volver a iniciar sesión" onPress={() => navigation.replace('SignIn')} staggerIndex={2} />
          </AuthCard>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <AuthGradientBackground />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <AuthBrandHeader
            title="Recuperar contraseña"
            subtitle="Te mandamos un enlace a tu correo para elegir una nueva"
          />

          <AuthCard staggerIndex={2}>
            <AuthTextField
              label="Correo electrónico"
              value={email}
              onChangeText={setEmail}
              placeholder="tu@email.com"
              keyboardType="email-address"
              hasError={status === 'error'}
            />

            {error ? (
              <AccessibleText color={colors.critical} bold style={styles.centerText}>
                {error}
              </AccessibleText>
            ) : null}

            <PrimaryAuthButton
              label="Enviar enlace"
              onPress={handleSubmit}
              disabled={!canSubmit}
              loading={status === 'submitting'}
            />
          </AuthCard>
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
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
});
