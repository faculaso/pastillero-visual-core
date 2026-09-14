import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { AuthStackParamList } from './types';
import { SignInScreen } from '../screens/auth/SignInScreen';
import { SignUpScreen } from '../screens/auth/SignUpScreen';
import { ForgotPasswordScreen } from '../screens/auth/ForgotPasswordScreen';

const Stack = createNativeStackNavigator<AuthStackParamList>();

/**
 * Se monta cuando `useSession().session` es `null` — reemplaza al viejo
 * `RoleSelectScreen` (sin cuentas reales). Sin header nativo: `SignInScreen`
 * y `SignUpScreen` traen su propio `AuthBrandHeader` (logo + título), y la
 * navegación entre ambas pantallas va por el CTA de pie de cada una, no por
 * el botón "atrás" del header.
 */
export function AuthStack(): React.JSX.Element {
  return (
    <Stack.Navigator initialRouteName="SignIn" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SignIn" component={SignInScreen} />
      <Stack.Screen name="SignUp" component={SignUpScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    </Stack.Navigator>
  );
}
