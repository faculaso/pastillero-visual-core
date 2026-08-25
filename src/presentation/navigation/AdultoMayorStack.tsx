import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { AdultoMayorStackParamList } from './types';
import { PastilleroVirtualScreen } from '../screens/pastillero-virtual/PastilleroVirtualScreen';
import { MiSemanaScreen } from '../screens/mi-semana/MiSemanaScreen';
import { useSession } from '../providers/SessionContext';

const Stack = createNativeStackNavigator<AdultoMayorStackParamList>();

/**
 * `PastilleroVirtual` (CU-02, tu toma actual) + `MiSemana` (vista semanal de
 * solo lectura, accesible desde el botón "Semana"). Las dos necesitan
 * `patientId` de la sesión (no es un route param), por eso se siguen
 * montando con render-prop en vez de `component={...}`.
 */
export function AdultoMayorStack(): React.JSX.Element {
  const { session } = useSession();
  // session siempre está presente acá: RootNavigator solo monta este stack con sesión activa.
  const patientId = session!.patientId;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="PastilleroVirtual">
        {({ navigation }) => <PastilleroVirtualScreen patientId={patientId} navigation={navigation} />}
      </Stack.Screen>
      <Stack.Screen name="MiSemana">
        {({ navigation }) => <MiSemanaScreen patientId={patientId} navigation={navigation} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
