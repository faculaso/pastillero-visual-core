import React, { useCallback, useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { bootstrap, type BootstrapResult } from '../infrastructure/bootstrap';
import { UseCasesProvider } from './providers/UseCasesProvider';
import { ErrorBoundary } from './providers/ErrorBoundary';
import { AccessibleText } from './design-system/AccessibleText';
import { AccessibleButton } from './design-system/AccessibleButton';
import { colors, spacing } from './design-system/tokens';
import { RootNavigator } from './navigation/RootNavigator';

type BootstrapState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly useCases: BootstrapResult }
  | { readonly status: 'error'; readonly message: string };

/**
 * Entry point de producción. Responsabilidades, en orden:
 *
 *  1. `bootstrap()` — abre SQLite, corre migraciones, arma todos los use
 *     cases y registra el handler de notificaciones de FOREGROUND. Es
 *     async, así que no puede correr antes de `render()`: la pantalla de
 *     carga inicial es parte necesaria del arranque, no un detalle
 *     cosmético.
 *  2. Si falla (ej. migración corrupta, disco lleno), se muestra un
 *     estado de error con un botón "Reintentar" — nunca una pantalla
 *     blanca silenciosa. Reintentar vuelve a llamar `bootstrap()` entero
 *     (abre la DB de nuevo, corre migraciones de nuevo — son idempotentes).
 *  3. `ErrorBoundary` envuelve `RootNavigator`: cubre errores de RENDER
 *     que ocurran después del arranque exitoso (bugs en una pantalla
 *     puntual), que `bootstrapError` no puede capturar por diseño de React.
 *
 * SOBRE BACKGROUND EVENTS: este archivo registra el handler de
 * notificaciones en FOREGROUND nada más (vía `bootstrap()` ->
 * `NotifeeNotificationScheduler.registerForegroundHandler()`). El de
 * BACKGROUND (`notifee.onBackgroundEvent`) NO se registra acá — no puede:
 * tiene que estar en `index.js`, ANTES de `AppRegistry.registerComponent`,
 * fuera del árbol de React por completo (un evento en background puede
 * llegar con la app totalmente cerrada, sin ningún componente montado).
 * Ver `index.js` en la raíz del proyecto host.
 */
export default function App(): React.JSX.Element {
  const [state, setState] = useState<BootstrapState>({ status: 'loading' });

  const runBootstrap = useCallback(() => {
    let cancelled = false;
    setState({ status: 'loading' });

    bootstrap()
      .then((useCases) => {
        if (!cancelled) setState({ status: 'ready', useCases });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            status: 'error',
            message: error instanceof Error ? error.message : 'Error desconocido al iniciar la app',
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => runBootstrap(), [runBootstrap]);

  if (state.status === 'error') {
    return (
      <View style={styles.centered}>
        <AccessibleText variant="title" color={colors.critical} bold style={styles.centerText}>
          No pudimos iniciar la aplicación
        </AccessibleText>
        <AccessibleText variant="body" color={colors.textSecondary} style={styles.centerText}>
          {state.message}
        </AccessibleText>
        <AccessibleButton label="Reintentar" onPress={runBootstrap} fullHeight />
      </View>
    );
  }

  if (state.status === 'loading') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <UseCasesProvider useCases={state.useCases}>
          <RootNavigator />
        </UseCasesProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  centerText: {
    textAlign: 'center',
  },
});
