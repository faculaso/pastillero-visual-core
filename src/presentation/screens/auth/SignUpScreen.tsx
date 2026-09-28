import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/types';
import type { UserRole } from '../../../domain';
import { useSession } from '../../providers/SessionContext';
import { useUseCases } from '../../providers/UseCasesProvider';
import { AccessibleText } from '../../design-system/AccessibleText';
import { AccessibleButton } from '../../design-system/AccessibleButton';
import { colors, radii, spacing } from '../../design-system/tokens';
import { authPalette } from './theme/auth-theme';
import { AuthGradientBackground } from './components/AuthGradientBackground';
import { AuthBrandHeader } from './components/AuthBrandHeader';
import { AuthCard } from './components/AuthCard';
import { AuthTextField } from './components/AuthTextField';
import { PairingCodeInput } from './components/PairingCodeInput';
import { PrimaryAuthButton } from './components/PrimaryAuthButton';
import { RoleOptionCard } from './components/RoleOptionCard';
import { useStaggeredEntrance } from '../../hooks/useStaggeredEntrance';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignUp'>;

function describeSignUpError(code: string | undefined): string {
  if (code === 'AUTH_EMAIL_ALREADY_IN_USE') return 'Ya existe una cuenta con ese correo.';
  if (code === 'INVITE_CODE_INVALID') return 'El código de invitación no es válido.';
  if (code === 'CANNOT_LINK_TO_SELF') return 'Ese es tu propio código de invitación. Necesitás el de la persona que vas a cuidar.';
  if (code === 'INVITE_CODE_ALREADY_USED') return 'Ese código ya lo usó otra persona. Pedile uno nuevo.';
  if (code === 'TOO_MANY_CAREGIVERS') return 'Esa persona ya tiene 3 cuidadores.';
  // Dice QUÉ pasó y QUÉ hacer, sin retar a nadie: que la contraseña haya
  // aparecido en una filtración no es culpa de quien la eligió.
  if (code === 'PASSWORD_LEAKED') {
    return 'Esa contraseña apareció en filtraciones de otros sitios y ya no es segura. Elegí otra distinta.';
  }
  return 'No pudimos crear la cuenta. Intentá de nuevo.';
}

const ROLE_OPTIONS: ReadonlyArray<{ readonly role: UserRole; readonly label: string; readonly hint: string }> = [
  { role: 'ADULTO_MAYOR', label: 'Soy el Adulto Mayor', hint: 'Vas a tener tu propio historial de tomas guardado' },
  { role: 'CUIDADOR', label: 'Soy el Cuidador', hint: 'Vas a poder ver los tratamientos que asignes y si se tomaron' },
];

export function SignUpScreen({ navigation }: Props): React.JSX.Element {
  const { signUp, session } = useSession();
  const { getProfile } = useUseCases();

  const [role, setRole] = useState<UserRole | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'error' | 'pending-confirmation' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [ownInviteCode, setOwnInviteCode] = useState<string | null>(null);
  // Hook llamado antes de cualquier `return` condicional de más abajo — las
  // reglas de hooks exigen el mismo orden en cada render, y esta pantalla
  // tiene varios estados terminales (`pending-confirmation`, `done`) que
  // retornan temprano.
  const footerEntrance = useStaggeredEntrance(8);

  // Al crear la cuenta con sesión inmediata (confirmación de email
  // desactivada), `useSession()` resuelve la sesión de forma asíncrona vía
  // `onAuthStateChange` — cuando por fin aparece y el rol es Adulto Mayor,
  // buscamos su propio código de invitación para mostrárselo (así se lo
  // puede pasar a su Cuidador).
  useEffect(() => {
    if (status !== 'idle' && status !== 'done') return;
    if (!session || session.role !== 'ADULTO_MAYOR') return;
    let cancelled = false;
    void getProfile.execute({ userId: session.patientId }).then((result) => {
      if (cancelled) return;
      if (result.ok && result.value.profile) {
        setOwnInviteCode(result.value.profile.inviteCode);
        setStatus('done');
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  async function handleSubmit(): Promise<void> {
    if (!role) return;
    setStatus('submitting');
    setError(null);

    const result = await signUp({
      email: email.trim(),
      password,
      role,
      displayName: displayName.trim(),
      inviteCode: role === 'CUIDADOR' ? inviteCode.trim() : undefined,
    });

    if (!result.ok) {
      setStatus('error');
      setError(describeSignUpError(result.errorCode));
      return;
    }
    if (result.pendingEmailConfirmation) {
      setStatus('pending-confirmation');
      return;
    }
    // Si el rol es Cuidador, ya no hay nada más que mostrar acá — `RootNavigator`
    // cambia de stack solo apenas la sesión resuelva. Si es Adulto Mayor, el
    // efecto de arriba se encarga de buscar y mostrar el código propio.
    setStatus('idle');
  }

  if (status === 'pending-confirmation') {
    return (
      <View style={styles.screen}>
        <AuthGradientBackground />
        <View style={styles.centered}>
          <AuthCard staggerIndex={0}>
            <AccessibleText variant="title" bold style={styles.centerText}>
              Revisá tu correo
            </AccessibleText>
            <AccessibleText variant="body" color={colors.textSecondary} style={styles.centerText}>
              Te mandamos un email para confirmar tu cuenta. Una vez confirmada, iniciá sesión normalmente.
            </AccessibleText>
            <PrimaryAuthButton label="Ir a iniciar sesión" onPress={() => navigation.replace('SignIn')} staggerIndex={2} />
          </AuthCard>
        </View>
      </View>
    );
  }

  if (status === 'done' && ownInviteCode) {
    return (
      <View style={styles.screen}>
        <AuthGradientBackground />
        <View style={styles.centered}>
          <AuthCard staggerIndex={0}>
            <AccessibleText variant="title" bold style={styles.centerText}>
              ¡Cuenta creada!
            </AccessibleText>
            <AccessibleText variant="body" color={colors.textSecondary} style={styles.centerText}>
              Compartí este código con tu Cuidador para que pueda ver y registrar tus tratamientos:
            </AccessibleText>
            <View style={styles.codeBox}>
              <AccessibleText variant="display" bold color={authPalette.clinicalBlue}>
                {ownInviteCode}
              </AccessibleText>
            </View>
          </AuthCard>
        </View>
      </View>
    );
  }

  const canSubmit =
    role !== null &&
    displayName.trim().length > 0 &&
    email.trim().length > 0 &&
    password.length >= 6 &&
    (role !== 'CUIDADOR' || inviteCode.trim().length > 0) &&
    status !== 'submitting';

  return (
    <View style={styles.screen}>
      <AuthGradientBackground />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <AuthBrandHeader title="Crear cuenta" subtitle="Configurá tu pastillero en un par de pasos" />

          <AuthCard staggerIndex={2}>
            <View style={styles.field}>
              <AccessibleText variant="small" bold color={colors.textSecondary}>
                ¿Quién va a usar esta cuenta?
              </AccessibleText>
              {ROLE_OPTIONS.map((option) => (
                <RoleOptionCard
                  key={option.role}
                  label={option.label}
                  hint={option.hint}
                  selected={role === option.role}
                  onPress={() => setRole(option.role)}
                />
              ))}
            </View>

            <AuthTextField label="Nombre" value={displayName} onChangeText={setDisplayName} placeholder="Nombre y apellido" autoCapitalize="words" />
            <AuthTextField
              label="Correo electrónico"
              value={email}
              onChangeText={setEmail}
              placeholder="tu@email.com"
              keyboardType="email-address"
            />
            <AuthTextField label="Contraseña" value={password} onChangeText={setPassword} placeholder="Mínimo 6 caracteres" secureTextEntry />

            {role === 'CUIDADOR' ? (
              <PairingCodeInput
                label="Código de invitación del Adulto Mayor"
                accessibilityLabel="Código de invitación"
                value={inviteCode}
                onChangeText={setInviteCode}
                hasError={status === 'error' && error === 'El código de invitación no es válido.'}
              />
            ) : null}

            {error ? (
              <AccessibleText color={colors.critical} bold style={styles.centerText}>
                {error}
              </AccessibleText>
            ) : null}

            <PrimaryAuthButton label="Crear cuenta" onPress={handleSubmit} disabled={!canSubmit} loading={status === 'submitting'} staggerIndex={7} />
          </AuthCard>

          <Animated.View style={[styles.footerRow, footerEntrance]}>
            <AccessibleText variant="small" color={colors.textSecondary}>
              ¿Ya tenés cuenta?
            </AccessibleText>
            <AccessibleButton label="Iniciá sesión" variant="secondary" onPress={() => navigation.navigate('SignIn')} />
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  field: { gap: spacing.sm },
  centerText: { textAlign: 'center' },
  footerRow: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  codeBox: {
    alignSelf: 'center',
    borderWidth: 2,
    borderColor: authPalette.clinicalBlue,
    backgroundColor: authPalette.glowSoft,
    borderRadius: radii.xl,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
});
