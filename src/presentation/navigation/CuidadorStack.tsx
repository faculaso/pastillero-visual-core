import React, { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { CuidadorStackParamList } from './types';
import { MisPacientesScreen } from '../screens/mis-pacientes/MisPacientesScreen';
import { CuidadorHomeScreen } from '../screens/cuidador-home/CuidadorHomeScreen';
import { RegisterTreatmentScreen } from '../screens/register-treatment/RegisterTreatmentScreen';
import { AdherenceDashboardScreen } from '../screens/adherence-dashboard/AdherenceDashboardScreen';
import { AccessibleText } from '../design-system/AccessibleText';
import { AppDialog } from '../design-system/AppDialog';
import { colors, spacing, typography } from '../design-system/tokens';
import { useSession } from '../providers/SessionContext';

const Stack = createNativeStackNavigator<CuidadorStackParamList>();

/** "Cambiar de rol" no cierra sesión: lleva al selector, que es también el único lugar desde donde se activa el otro rol con el mismo correo. */
function AccountHeaderButton(): React.JSX.Element {
  const { signOut, switchRole } = useSession();
  const [abierto, setAbierto] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => setAbierto(true)}
        accessibilityRole="button"
        accessibilityLabel="Tu cuenta: cambiar de rol o cerrar sesión"
        hitSlop={8}
        style={styles.accountButton}
      >
        <AccessibleText variant="small" bold color={colors.primary}>
          Cuenta
        </AccessibleText>
      </Pressable>

      <AppDialog
        visible={abierto}
        title="Tu cuenta"
        message="¿Qué querés hacer?"
        onDismiss={() => setAbierto(false)}
        actions={[
          { label: 'Cambiar de rol', onPress: () => { setAbierto(false); switchRole(); } },
          { label: 'Cerrar sesión', variant: 'danger', onPress: () => { setAbierto(false); void signOut(); } },
          { label: 'Cancelar', variant: 'secondary', onPress: () => setAbierto(false) },
        ]}
      />
    </>
  );
}

/**
 * `MisPacientes` es la ruta raíz: primero se elige a quién se gestiona y
 * recién después se abre su semana (`CuidadorHome`), con `RegisterTreatment`
 * y `AdherenceDashboard` apilados arriba. Así "atrás" desde la semana vuelve
 * a la lista en vez de quedar en un callejón sin salida, y un Cuidador con
 * dos personas a cargo tiene por dónde pasar de una a la otra.
 *
 * CU-01 -> CU-03: al guardar un tratamiento (`RegisterTreatmentScreen`) se
 * navega con `replace` (no `push`) al dashboard de ese mismo tratamiento —
 * "atrás" desde ahí no debería reabrir el formulario ya enviado. Como
 * `replace` solo pisa el tope de la pila, sigue yendo a `CuidadorHome`.
 */
export function CuidadorStack(): React.JSX.Element {
  return (
    <Stack.Navigator
      initialRouteName="MisPacientes"
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTitleStyle: { fontSize: typography.label, color: colors.textPrimary },
        headerTintColor: colors.primary,
        headerRight: () => <AccountHeaderButton />,
      }}
    >
      <Stack.Screen
        name="MisPacientes"
        component={MisPacientesScreen}
        options={{ title: 'A quiénes cuidás' }}
      />
      <Stack.Screen name="CuidadorHome" component={CuidadorHomeScreen} options={tituloDelPaciente} />
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

/** El título de la semana dice de quién es: con dos personas a cargo, "Semana de quien cuidás" no alcanza para saber dónde estás parado. */
function TituloDelPaciente(): React.JSX.Element {
  const { session } = useSession();
  const nombre = session?.patientName?.trim();
  return (
    <AccessibleText variant="label" bold numberOfLines={1}>
      {nombre ? `Semana de ${nombre}` : 'Semana'}
    </AccessibleText>
  );
}

const tituloDelPaciente = { headerTitle: () => <TituloDelPaciente /> };

const styles = StyleSheet.create({
  accountButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
});
