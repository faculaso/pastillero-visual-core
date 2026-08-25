import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { AuthStackParamList } from './types';
import { SignInScreen } from '../screens/auth/SignInScreen';
import { SignUpScreen } from '../screens/auth/SignUpScreen';
import { colors, typography } from '../design-system/tokens';

const Stack = createNativeStackNavigator<AuthStackParamList>();

/** Se monta cuando `useSession().session` es `null` — reemplaza al viejo `RoleSelectScreen` (sin cuentas reales). */
export function AuthStack(): React.JSX.Element {
  return (
    <Stack.Navigator
      initialRouteName="SignIn"
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTitleStyle: { fontSize: typography.label, color: colors.textPrimary },
        headerTintColor: colors.primary,
      }}
    >
      <Stack.Screen name="SignIn" component={SignInScreen} options={{ title: 'Iniciar sesión' }} />
      <Stack.Screen name="SignUp" component={SignUpScreen} options={{ title: 'Crear cuenta' }} />
    </Stack.Navigator>
  );
}
