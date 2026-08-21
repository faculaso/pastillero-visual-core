import React from 'react';
import { View, StyleSheet } from 'react-native';
import { AccessibleText } from '../design-system/AccessibleText';
import { AccessibleButton } from '../design-system/AccessibleButton';
import { colors, spacing } from '../design-system/tokens';

interface ErrorBoundaryProps {
  readonly children: React.ReactNode;
}

interface ErrorBoundaryState {
  readonly error: Error | null;
}

/**
 * Red de seguridad de producción: un error de render en cualquier
 * componente de abajo (ej. una pantalla que revienta con datos
 * inesperados) NO debe dejar al Adulto Mayor mirando una pantalla blanca
 * sin ninguna acción posible. `getDerivedStateFromError` es la única API
 * de React para esto — no tiene equivalente en hooks, por eso es la única
 * clase de todo el codebase.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // Punto de integración con un servicio de crash-reporting real
    // (Sentry, Crashlytics, etc.) — fuera de alcance de este Core.
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  private handleReset = (): void => {
    this.setState({ error: null });
  };

  render(): React.ReactNode {
    if (this.state.error) {
      return (
        <View style={styles.container}>
          <AccessibleText variant="title" bold color={colors.critical} style={styles.text}>
            Ocurrió un problema inesperado
          </AccessibleText>
          <AccessibleText variant="body" color={colors.textSecondary} style={styles.text}>
            Podés intentar de nuevo. Si el problema sigue, avisale a tu cuidador.
          </AccessibleText>
          <AccessibleButton label="Reintentar" onPress={this.handleReset} fullHeight />
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  text: {
    textAlign: 'center',
  },
});
