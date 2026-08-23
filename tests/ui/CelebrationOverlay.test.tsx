import React from 'react';
import { render, screen, act } from '@testing-library/react-native';
import { CelebrationOverlay } from '../../src/presentation/screens/pastillero-virtual/components/CelebrationOverlay';

/**
 * `getByText` excluye por default los elementos marcados
 * `accessibilityElementsHidden` (simula lo que un lector de pantalla vería
 * — que es justamente lo que `CelebrationOverlay` configura a propósito,
 * ver su docblock). Por eso todas las queries acá pasan
 * `{ includeHiddenElements: true }` — el overlay SIGUE estando oculto para
 * accesibilidad en producción, solo estamos verificando su contenido.
 */
const HIDDEN = { includeHiddenElements: true };

describe('CelebrationOverlay', () => {
  it('no renderiza nada en el montaje inicial (trigger=0)', async () => {
    const view = await render(<CelebrationOverlay trigger={0} />);
    expect(view.toJSON()).toBeNull();
  });

  it('muestra el checkmark cuando trigger cambia', async () => {
    const view = await render(<CelebrationOverlay trigger={0} />);
    await act(async () => {
      view.rerender(<CelebrationOverlay trigger={1} />);
    });

    expect(screen.getByText('✓', HIDDEN)).toBeTruthy();
  });

  it('muestra el confeti junto al checkmark', async () => {
    const view = await render(<CelebrationOverlay trigger={0} />);
    await act(async () => {
      view.rerender(<CelebrationOverlay trigger={1} />);
    });

    expect(screen.getAllByText('✨', HIDDEN).length).toBeGreaterThan(0);
    expect(screen.getByText('🎉', HIDDEN)).toBeTruthy();
  });

  it('vuelve a dispararse si trigger cambia de nuevo (confirmar una segunda toma)', async () => {
    const view = await render(<CelebrationOverlay trigger={1} />);
    await act(async () => {
      view.rerender(<CelebrationOverlay trigger={2} />);
    });

    expect(screen.getByText('✓', HIDDEN)).toBeTruthy();
  });

  it('es puramente decorativo: pointerEvents="none" y oculto para lectores de pantalla', async () => {
    const view = await render(<CelebrationOverlay trigger={0} />);
    await act(async () => {
      view.rerender(<CelebrationOverlay trigger={1} />);
    });

    const tree = view.toJSON();
    const overlayRoot = Array.isArray(tree) ? tree[0] : tree;
    expect(overlayRoot?.props.pointerEvents).toBe('none');
    expect(overlayRoot?.props.accessibilityElementsHidden).toBe(true);
    expect(overlayRoot?.props.importantForAccessibility).toBe('no-hide-descendants');
  });

  it('no dispara la animación en el montaje si trigger arranca en 0 (no confunde "recién abierto" con "recién confirmado")', async () => {
    const view = await render(<CelebrationOverlay trigger={0} />);
    expect(screen.queryByText('✓', HIDDEN)).toBeNull();
    expect(view.toJSON()).toBeNull();
  });
});
