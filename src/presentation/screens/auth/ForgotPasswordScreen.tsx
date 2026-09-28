import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
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

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

const MIN_PASSWORD_LENGTH = 6;

/**
 * Largo MÍNIMO del código, no exacto.
 *
 * Estaba fijo en 6 y dejaba el botón deshabilitado para siempre, porque este
 * proyecto emite códigos de 8 dígitos. La documentación de Supabase se
 * contradice —la tabla de variables de plantilla dice "6-digit
 * One-Time-Password" y la guía de plantillas dice "8-digit"— y además el largo
 * depende de la configuración del proyecto, así que no hay ningún número
 * correcto para fijar acá.
 *
 * Si el código sirve o no lo decide el servidor en `verifyOtp`, y ese camino ya
 * está cubierto con su propio mensaje. Del lado del cliente sólo se evita
 * mandar algo obviamente incompleto, que es lo único que se puede saber sin
 * preguntar.
 */
const MIN_CODE_LENGTH = 6;

/**
 * Reseteo en dos pasos, los dos DENTRO de la app: se pide el código por
 * correo y después se tipea ahí mismo junto con la contraseña nueva.
 *
 * Por qué un código y no el link del correo. El link de Supabase apunta al
 * Site URL del proyecto, que en un teléfono no existe — `localhost` es el
 * propio teléfono y devuelve ERR_CONNECTION_REFUSED. Pasó de verdad, con el
 * correo llegando perfecto. Un deep link era la otra salida, pero obliga a
 * registrar un esquema propio y a confiar en que el cliente de correo lo
 * respete; el código no depende de nada de eso y además es un gesto que
 * cualquiera ya tiene aprendido del banco.
 *
 * El correo NO se puede editar en el segundo paso: el código se emitió para
 * esa dirección, así que dejarlo cambiar solo serviría para que el código
 * deje de funcionar sin explicación. Para corregirlo está "Usar otro correo",
 * que vuelve al paso 1 en limpio.
 */
export function ForgotPasswordScreen({ navigation }: Props): React.JSX.Element {
  const { requestPasswordReset, completePasswordReset } = useSession();
  const [paso, setPaso] = useState<'pedir-codigo' | 'elegir-contrasena' | 'listo'>('pedir-codigo');
  const [email, setEmail] = useState('');
  const [codigo, setCodigo] = useState('');
  const [password, setPassword] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pedirCodigo(): Promise<void> {
    setEnviando(true);
    setError(null);
    const result = await requestPasswordReset(email.trim());
    setEnviando(false);
    if (!result.ok) {
      setError('No pudimos enviar el correo. Intentá de nuevo.');
      return;
    }
    setPaso('elegir-contrasena');
  }

  async function guardarContrasena(): Promise<void> {
    setEnviando(true);
    setError(null);
    const result = await completePasswordReset(email.trim(), codigo.trim(), password);
    setEnviando(false);
    if (!result.ok) {
      setError(
        result.errorCode === 'RECOVERY_CODE_INVALID'
          ? 'Ese código no es válido o ya venció. Pedí uno nuevo.'
          : 'No pudimos cambiar la contraseña. Intentá de nuevo.',
      );
      return;
    }
    setPaso('listo');
  }

  function volverAlInicio(): void {
    setPaso('pedir-codigo');
    setCodigo('');
    setPassword('');
    setError(null);
  }

  if (paso === 'listo') {
    return (
      <View style={styles.screen}>
        <AuthGradientBackground />
        <View style={styles.centered}>
          <AuthCard staggerIndex={0}>
            <AccessibleText variant="title" bold style={styles.centerText}>
              Listo, ya podés entrar
            </AccessibleText>
            <AccessibleText variant="body" color={colors.textSecondary} style={styles.centerText}>
              Tu contraseña quedó cambiada.
            </AccessibleText>
            <PrimaryAuthButton
              label="Iniciar sesión"
              onPress={() => navigation.replace('SignIn')}
              staggerIndex={2}
            />
          </AuthCard>
        </View>
      </View>
    );
  }

  const enPasoDelCodigo = paso === 'elegir-contrasena';
  const puedeEnviar = enPasoDelCodigo
    ? codigo.trim().length >= MIN_CODE_LENGTH && password.length >= MIN_PASSWORD_LENGTH && !enviando
    : email.trim().length > 0 && !enviando;

  return (
    <View style={styles.screen}>
      <AuthGradientBackground />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <AuthBrandHeader
            title="Recuperar contraseña"
            subtitle={
              enPasoDelCodigo
                ? `Te mandamos un código a ${email.trim()}`
                : 'Te mandamos un código a tu correo para elegir una nueva'
            }
          />

          <AuthCard staggerIndex={2}>
            {enPasoDelCodigo ? (
              <>
                <AuthTextField
                  label="Código del correo"
                  value={codigo}
                  onChangeText={setCodigo}
                  placeholder="El código del correo"
                  keyboardType="number-pad"
                  hasError={error !== null}
                />
                <AuthTextField
                  label="Contraseña nueva"
                  value={password}
                  onChangeText={setPassword}
                  placeholder={`Mínimo ${MIN_PASSWORD_LENGTH} caracteres`}
                  secureTextEntry
                />
              </>
            ) : (
              <AuthTextField
                label="Correo electrónico"
                value={email}
                onChangeText={setEmail}
                placeholder="tu@email.com"
                keyboardType="email-address"
                autoCapitalize="none"
                hasError={error !== null}
              />
            )}

            {error ? (
              <AccessibleText color={colors.critical} bold style={styles.centerText}>
                {error}
              </AccessibleText>
            ) : null}

            <PrimaryAuthButton
              label={enPasoDelCodigo ? 'Cambiar la contraseña' : 'Enviarme el código'}
              onPress={enPasoDelCodigo ? guardarContrasena : pedirCodigo}
              disabled={!puedeEnviar}
              loading={enviando}
            />

            {enPasoDelCodigo ? (
              <AccessibleButton label="Usar otro correo" variant="secondary" onPress={volverAlInicio} />
            ) : null}
          </AuthCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl, flexGrow: 1, justifyContent: 'center' },
  centerText: { textAlign: 'center' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
});
