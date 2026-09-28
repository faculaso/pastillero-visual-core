import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { UserRole } from '../../../domain';
import { useSession } from '../../providers/SessionContext';
import { AccessibleText } from '../../design-system/AccessibleText';
import { AppDialog } from '../../design-system/AppDialog';
import { colors, spacing } from '../../design-system/tokens';
import { AuthGradientBackground } from './components/AuthGradientBackground';
import { AuthBrandHeader } from './components/AuthBrandHeader';
import { AuthCard } from './components/AuthCard';
import { RoleEntryCard } from './components/RoleEntryCard';

interface RoleCopy {
  readonly entrar: string;
  readonly entrarHint: string;
  readonly activar: string;
  readonly activarHint: string;
  readonly confirmar: string;
}

const COPY: Record<UserRole, RoleCopy> = {
  ADULTO_MAYOR: {
    entrar: 'Entrar como Adulto Mayor',
    entrarHint: 'Tu pastillero, para ver y confirmar tus propias tomas',
    activar: 'Activar también Adulto Mayor',
    activarHint: 'Para llevar tus propias tomas con este mismo correo',
    confirmar: 'Vas a poder llevar tu propio pastillero con esta misma cuenta, y se te va a generar tu código para dárselo a quien te cuide. Tus tratamientos de Cuidador no se tocan.',
  },
  CUIDADOR: {
    entrar: 'Entrar como Cuidador',
    entrarHint: 'Los tratamientos de quien cuidás y si se tomaron',
    activar: 'Activar también Cuidador',
    activarHint: 'Para asignarle tratamientos a otra persona con este mismo correo',
    confirmar: 'Vas a poder vincularte con un código y asignarle tratamientos a otra persona. Tu propio pastillero no se toca.',
  },
};

const TODOS: readonly UserRole[] = ['ADULTO_MAYOR', 'CUIDADOR'];

/**
 * Se muestra cuando hay cuenta autenticada pero todavía no hay rol activo
 * (`roleChoice` en `SessionContext`). Dos casos:
 *
 *  - La cuenta tiene los dos roles: hay que preguntar con cuál entra hoy.
 *  - Se tocó "Cambiar de rol" desde adentro: aunque tenga uno solo, este es
 *    el lugar donde se activa el otro.
 *
 * No está en `AuthStack` a propósito: no es un paso del login (ya hay
 * sesión de Supabase), es un paso previo a elegir stack. `RootNavigator` la
 * monta antes de `AdultoMayorStack`/`CuidadorStack`.
 */
export function ChooseRoleScreen(): React.JSX.Element {
  const { roleChoice, chooseRole, enableRole, signOut } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const roles = roleChoice?.roles ?? [];
  const faltantes = TODOS.filter((role) => !roles.includes(role));
  const nombre = roleChoice?.displayName?.trim();

  /** `null` = ningún cartel abierto. */
  const [porActivar, setPorActivar] = useState<UserRole | null>(null);
  const [salidaAbierta, setSalidaAbierta] = useState(false);

  async function activar(role: UserRole): Promise<void> {
    setBusy(true);
    setError(null);
    const result = await enableRole(role);
    setBusy(false);
    if (!result.ok) setError('No pudimos activar el otro rol. Intentá de nuevo.');
  }

  return (
    <View style={styles.screen}>
      <AuthGradientBackground />
      <ScrollView contentContainerStyle={styles.content}>
        <AuthBrandHeader
          title={nombre ? `Hola, ${nombre}` : 'Hola'}
          subtitle={roles.length > 1 ? '¿Cómo querés entrar hoy?' : 'Entrá con tu rol, o activá el otro'}
        />

        <AuthCard staggerIndex={2}>
          {roles.map((role) => (
            <RoleEntryCard
              key={role}
              label={COPY[role].entrar}
              hint={COPY[role].entrarHint}
              disabled={busy}
              onPress={() => void chooseRole(role)}
            />
          ))}
        </AuthCard>

        {faltantes.length > 0 ? (
          <AuthCard staggerIndex={3}>
            <AccessibleText variant="small" color={colors.textSecondary}>
              Una misma cuenta puede cumplir los dos roles: no hace falta otro correo.
            </AccessibleText>
            {faltantes.map((role) => (
              <RoleEntryCard
                key={role}
                variant="secondary"
                label={COPY[role].activar}
                hint={COPY[role].activarHint}
                disabled={busy}
                onPress={() => setPorActivar(role)}
              />
            ))}
          </AuthCard>
        ) : null}

        {error ? (
          <AccessibleText color={colors.critical} bold style={styles.centerText} accessibilityLiveRegion="polite">
            {error}
          </AccessibleText>
        ) : null}

        <Pressable
          onPress={() => setSalidaAbierta(true)}
          accessibilityRole="button"
          accessibilityLabel="Cerrar sesión"
          hitSlop={8}
          style={styles.signOut}
        >
          <AccessibleText variant="small" bold color={colors.primary}>
            Cerrar sesión
          </AccessibleText>
        </Pressable>
      </ScrollView>

      <AppDialog
        visible={porActivar !== null}
        title="Activar el otro rol"
        message={porActivar ? COPY[porActivar].confirmar : undefined}
        onDismiss={() => setPorActivar(null)}
        actions={[
          {
            label: 'Activar',
            onPress: () => {
              const role = porActivar;
              setPorActivar(null);
              if (role) void activar(role);
            },
          },
          { label: 'Cancelar', variant: 'secondary', onPress: () => setPorActivar(null) },
        ]}
      />

      <AppDialog
        visible={salidaAbierta}
        title="Cerrar sesión"
        message="¿Querés salir de tu cuenta?"
        onDismiss={() => setSalidaAbierta(false)}
        actions={[
          {
            label: 'Cerrar sesión',
            variant: 'danger',
            onPress: () => {
              setSalidaAbierta(false);
              void signOut();
            },
          },
          { label: 'Cancelar', variant: 'secondary', onPress: () => setSalidaAbierta(false) },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.xxl,
    flexGrow: 1,
    justifyContent: 'center',
  },
  centerText: { textAlign: 'center' },
  signOut: { alignSelf: 'center', paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
});
