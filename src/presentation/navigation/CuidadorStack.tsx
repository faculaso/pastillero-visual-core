import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { CuidadorStackParamList } from './types';
import { RegisterTreatmentScreen } from '../screens/register-treatment/RegisterTreatmentScreen';
import { AdherenceDashboardScreen } from '../screens/adherence-dashboard/AdherenceDashboardScreen';
import { colors, typography } from '../design-system/tokens';

const Stack = createNativeStackNavigator<CuidadorStackParamList>();

/**
 * CU-01 -> CU-03: al guardar un tratamiento (`RegisterTreatmentScreen`) se
 * navega con `replace` (no `push`) al dashboard de ese mismo tratamiento —
 * volver "atrás" desde el dashboard no debería reabrir el formulario ya
 * enviado, sino salir de la stack.
 */
export function CuidadorStack(): React.JSX.Element {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTitleStyle: { fontSize: typography.label, color: colors.textPrimary },
        headerTintColor: colors.primary,
      }}
    >
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
