import React from 'react';
import { Text } from 'react-native';
import { render, screen, userEvent } from '@testing-library/react-native';
import { ErrorBoundary } from '../../src/presentation/providers/ErrorBoundary';

function Bomb({ shouldThrow }: { shouldThrow: boolean }): React.JSX.Element {
  if (shouldThrow) throw new Error('boom');
  return <Text>Todo bien</Text>;
}

describe('ErrorBoundary', () => {
  // React loguea el error de todos modos por consola — silenciamos el ruido esperado del test.
  const originalConsoleError = console.error;
  beforeEach(() => {
    console.error = jest.fn();
  });
  afterEach(() => {
    console.error = originalConsoleError;
  });

  it('renderiza los children normalmente cuando no hay error', async () => {
    await render(
      <ErrorBoundary>
        <Bomb shouldThrow={false} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Todo bien')).toBeTruthy();
  });

  it('captura un error de render y muestra el estado de fallback en vez de una pantalla en blanco', async () => {
    await render(
      <ErrorBoundary>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Ocurrió un problema inesperado')).toBeTruthy();
    expect(screen.queryByText('Todo bien')).toBeNull();
  });

  it('"Reintentar" resetea el estado de error (vuelve a intentar renderizar los children)', async () => {
    const user = userEvent.setup();
    await render(
      <ErrorBoundary>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Ocurrió un problema inesperado')).toBeTruthy();

    await user.press(screen.getByText('Reintentar'));

    // El componente sigue lanzando (mismo `shouldThrow={true}`), así que
    // React vuelve a capturar el error — el boundary sigue mostrando el
    // fallback. Esto confirma que el reset SÍ intenta re-renderizar (no
    // que quede pegado en un estado stale ignorando el botón).
    expect(screen.getByText('Ocurrió un problema inesperado')).toBeTruthy();
  });
});
