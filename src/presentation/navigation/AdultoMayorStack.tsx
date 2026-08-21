import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { AdultoMayorStackParamList } from './types';
import { PastilleroVirtualScreen } from '../screens/pastillero-virtual/PastilleroVirtualScreen';
import { useSession } from '../providers/SessionContext';

const Stack = createNativeStackNavigator<AdultoMayorStackParamList>();

/**
 * Una sola pantalla por ahora (CU-02 es autocontenido: no hay "navegar a
 * otro lado" para el Adulto Mayor en el alcance actual). El Stack existe
 * igual, no una pantalla suelta, para no tener que reestructurar cuando se
 * agregue historial de tomas o configuración accesible.
 */
export function AdultoMayorStack(): React.JSX.Element {
  const { session } = useSession();
  // session siempre está presente acá: RootNavigator solo monta este stack con sesión activa.
  const patientId = session!.patientId;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="PastilleroVirtual">
        {() => <PastilleroVirtualScreen patientId={patientId} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
