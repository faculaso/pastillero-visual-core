import React, { useEffect, useState } from 'react';
import { View, TextInput, Pressable, StyleSheet, ScrollView } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/types';
import type { UserRole } from '../../../domain';
import { useSession } from '../../providers/SessionContext';
import { useUseCases } from '../../providers/UseCasesProvider';
import { AccessibleText } from '../../design-system/AccessibleText';
import { AccessibleButton } from '../../design-system/AccessibleButton';
import { colors, radii, spacing, touchTarget, typography } from '../../design-system/tokens';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignUp'>;

function describeSignUpError(code: string | undefined): string {
  if (code === 'AUTH_EMAIL_ALREADY_IN_USE') return 'Ya existe una cuenta con ese correo.';
  if (code === 'INVITE_CODE_INVALID') return 'El código de invitación no es válido.';
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
      <View style={styles.centered}>
        <AccessibleText variant="title" bold style={styles.centerText}>
          Revisá tu correo
        </AccessibleText>
        <AccessibleText variant="body" color={colors.textSecondary} style={styles.centerText}>
          Te mandamos un email para confirmar tu cuenta. Una vez confirmada, iniciá sesión normalmente.
        </AccessibleText>
        <AccessibleButton label="Ir a iniciar sesión" onPress={() => navigation.replace('SignIn')} fullHeight />
      </View>
    );
  }

  if (status === 'done' && ownInviteCode) {
    return (
      <View style={styles.centered}>
        <AccessibleText variant="title" bold style={styles.centerText}>
          ¡Cuenta creada!
        </AccessibleText>
        <AccessibleText variant="body" color={colors.textSecondary} style={styles.centerText}>
          Compartí este código con tu Cuidador para que pueda ver y registrar tus tratamientos:
        </AccessibleText>
        <View style={styles.codeBox}>
          <AccessibleText variant="display" bold color={colors.primaryDark}>
            {ownInviteCode}
          </AccessibleText>
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
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <AccessibleText variant="title" bold style={styles.title}>
        Crear cuenta
      </AccessibleText>

      <View style={styles.field}>
        <AccessibleText variant="small" bold color={colors.textSecondary}>
          ¿Quién va a usar esta cuenta?
        </AccessibleText>
        {ROLE_OPTIONS.map((option) => {
          const selected = role === option.role;
          return (
            <Pressable
              key={option.role}
              onPress={() => setRole(option.role)}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={option.label}
              style={[styles.roleCard, selected && styles.roleCardSelected]}
            >
              <AccessibleText variant="label" bold color={selected ? colors.primaryDark : colors.textPrimary}>
                {option.label}
              </AccessibleText>
              <AccessibleText variant="small" color={colors.textSecondary}>
                {option.hint}
              </AccessibleText>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.field}>
        <AccessibleText variant="small" bold color={colors.textSecondary}>
          Nombre
        </AccessibleText>
        <TextInput
          style={styles.input}
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="Nombre y apellido"
          placeholderTextColor={colors.textSecondary}
          accessibilityLabel="Nombre"
        />
      </View>

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
          placeholder="Mínimo 6 caracteres"
          placeholderTextColor={colors.textSecondary}
          secureTextEntry
          accessibilityLabel="Contraseña"
        />
      </View>

      {role === 'CUIDADOR' ? (
        <View style={styles.field}>
          <AccessibleText variant="small" bold color={colors.textSecondary}>
            Código de invitación del Adulto Mayor
          </AccessibleText>
          <TextInput
            style={styles.input}
            value={inviteCode}
            onChangeText={(text) => setInviteCode(text.toUpperCase())}
            placeholder="Ej: 7F2K9M"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="characters"
            accessibilityLabel="Código de invitación"
          />
        </View>
      ) : null}

      {error ? (
        <AccessibleText color={colors.critical} bold style={styles.error}>
          {error}
        </AccessibleText>
      ) : null}

      <AccessibleButton
        label="Crear cuenta"
        onPress={handleSubmit}
        disabled={!canSubmit}
        loading={status === 'submitting'}
        fullHeight
      />

      <View style={styles.footerRow}>
        <AccessibleText variant="small" color={colors.textSecondary}>
          ¿Ya tenés cuenta?
        </AccessibleText>
        <AccessibleButton label="Iniciá sesión" variant="secondary" onPress={() => navigation.navigate('SignIn')} />
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
  roleCard: {
    borderWidth: 2,
    borderColor: colors.borderLight,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.xs,
  },
  roleCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  error: { textAlign: 'center' },
  footerRow: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  centerText: { textAlign: 'center' },
  codeBox: {
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
    borderRadius: radii.xl,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
});
