import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SessionProvider, useSession } from '../providers/SessionContext';
import { AuthStack } from './AuthStack';
import { ChooseRoleScreen } from '../screens/auth/ChooseRoleScreen';
import { AdultoMayorStack } from './AdultoMayorStack';
import { CuidadorStack } from './CuidadorStack';
import { colors } from '../design-system/tokens';

/**
 * El switch de roles vive ACÁ, no dentro de cada Stack — así
 * `AdultoMayorStack` y `CuidadorStack` no necesitan saber que el otro
 * existe, y agregar un tercer rol en el futuro (ej. "Familiar solo
 * lectura") no toca ninguno de los dos.
 */
function RoleSwitch(): React.JSX.Element {
  const { session, status, roleChoice } = useSession();

  // Mientras se restaura la sesión de Supabase (o se resuelve el rol/paciente
  // vinculado tras un login recién hecho), no hay que mostrar el login por
  // un instante y después "saltar" al stack correcto — mejor un loader corto.
  if (status === 'loading') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Hay cuenta pero todavía no rol activo: la cuenta tiene los dos roles y
  // hay que preguntar, o se pidió cambiar de rol desde adentro.
  if (roleChoice) return <ChooseRoleScreen />;

  if (!session) return <AuthStack />;
  if (session.role === 'ADULTO_MAYOR') return <AdultoMayorStack />;
  return <CuidadorStack />;
}

export function RootNavigator(): React.JSX.Element {
  return (
    <SessionProvider>
      <NavigationContainer>
        <RoleSwitch />
      </NavigationContainer>
    </SessionProvider>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
