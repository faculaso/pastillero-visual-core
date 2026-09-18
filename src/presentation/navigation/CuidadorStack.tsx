import React from 'react';
import { Alert, Pressable, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { CuidadorStackParamList } from './types';
import { CuidadorHomeScreen } from '../screens/cuidador-home/CuidadorHomeScreen';
import { RegisterTreatmentScreen } from '../screens/register-treatment/RegisterTreatmentScreen';
import { AdherenceDashboardScreen } from '../screens/adherence-dashboard/AdherenceDashboardScreen';
import { AccessibleText } from '../design-system/AccessibleText';
import { colors, spacing, typography } from '../design-system/tokens';
import { useSession } from '../providers/SessionContext';

const Stack = createNativeStackNavigator<CuidadorStackParamList>();

/** "Cambiar de rol" no cierra sesión: lleva al selector, que es también el único lugar desde donde se activa el otro rol con el mismo correo. */
function AccountHeaderButton(): React.JSX.Element {
  const { signOut, switchRole } = useSession();

  function handlePress(): void {
    Alert.alert('Tu cuenta', '¿Qué querés hacer?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cambiar de rol', onPress: switchRole },
      { text: 'Cerrar sesión', style: 'destructive', onPress: () => void signOut() },
    ]);
  }

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel="Tu cuenta: cambiar de rol o cerrar sesión"
      hitSlop={8}
      style={styles.accountButton}
    >
      <AccessibleText variant="small" bold color={colors.primary}>
        Cuenta
      </AccessibleText>
    </Pressable>
  );
}

/**
 * `CuidadorHome` (el pastillero semanal) es la ruta raíz — `RegisterTreatment`
 * y `AdherenceDashboard` se apilan (push) arriba, así que "atrás" siempre
 * vuelve a la semana en vez de quedar en un callejón sin salida.
 *
 * CU-01 -> CU-03: al guardar un tratamiento (`RegisterTreatmentScreen`) se
 * navega con `replace` (no `push`) al dashboard de ese mismo tratamiento —
 * "atrás" desde ahí no debería reabrir el formulario ya enviado. Como
 * `replace` solo pisa el tope de la pila, sigue yendo a `CuidadorHome`.
 */
export function CuidadorStack(): React.JSX.Element {
  return (
    <Stack.Navigator
      initialRouteName="CuidadorHome"
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTitleStyle: { fontSize: typography.label, color: colors.textPrimary },
        headerTintColor: colors.primary,
        headerRight: () => <AccountHeaderButton />,
      }}
    >
      <Stack.Screen
        name="CuidadorHome"
        component={CuidadorHomeScreen}
        options={{ title: 'Semana de quien cuidás' }}
      />
      <Stack.Screen
        name="RegisterTreatment"
        component={RegisterTreatmentScreen}
        options={{ title: 'Nuevo tratamiento' }}
      />
      <Stack.Screen
        name="AdherenceDashboard"
        component={AdherenceDashboardScreen}
        options={{ title: 'Adherencia' }}
      />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  accountButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
});
