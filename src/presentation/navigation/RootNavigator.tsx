import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SessionProvider, useSession } from '../providers/SessionContext';
import { RoleSelectScreen } from '../screens/RoleSelectScreen';
import { AdultoMayorStack } from './AdultoMayorStack';
import { CuidadorStack } from './CuidadorStack';

/**
 * El switch de roles vive ACÁ, no dentro de cada Stack — así
 * `AdultoMayorStack` y `CuidadorStack` no necesitan saber que el otro
 * existe, y agregar un tercer rol en el futuro (ej. "Familiar solo
 * lectura") no toca ninguno de los dos.
 */
function RoleSwitch(): React.JSX.Element {
  const { session } = useSession();

  if (!session) return <RoleSelectScreen />;
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
