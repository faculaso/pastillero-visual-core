import React from 'react';
import { AccessibilityInfo } from 'react-native';
import { render, act } from '@testing-library/react-native';
import { CelebrationOverlay } from '../../src/presentation/screens/pastillero-virtual/components/CelebrationOverlay';

describe('CelebrationOverlay', () => {
  it('no renderiza nada en el montaje inicial (trigger=0)', async () => {
    const view = await render(<CelebrationOverlay trigger={0} />);
    expect(view.toJSON()).toBeNull();
  });

  it('muestra la animación de la toma cuando trigger cambia', async () => {
    const view = await render(<CelebrationOverlay trigger={0} />);
    await act(async () => {
      view.rerender(<CelebrationOverlay trigger={1} />);
    });

    expect(view.toJSON()).not.toBeNull();
  });

  it('vuelve a dispararse si trigger cambia de nuevo (confirmar una segunda toma)', async () => {
    const view = await render(<CelebrationOverlay trigger={1} />);
    await act(async () => {
      view.rerender(<CelebrationOverlay trigger={2} />);
    });

    expect(view.toJSON()).not.toBeNull();
  });

  it('anuncia la confirmación con el nombre del medicamento para lectores de pantalla', async () => {
    // El overlay en sí queda oculto (una animación no se puede "leer"), así
    // que sin este anuncio el cambio de estado más importante de la app sería
    // silencioso para tecnología asistiva.
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    const view = await render(<CelebrationOverlay trigger={0} medicationName="Paracetamol" />);
    await act(async () => {
      view.rerender(<CelebrationOverlay trigger={1} medicationName="Paracetamol" />);
    });

    expect(announce).toHaveBeenCalledWith('Listo. Tomaste Paracetamol.');
    announce.mockRestore();
  });

  it('anuncia un mensaje genérico si no se conoce el medicamento', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    const view = await render(<CelebrationOverlay trigger={0} />);
    await act(async () => {
      view.rerender(<CelebrationOverlay trigger={1} />);
    });

    expect(announce).toHaveBeenCalledWith('Listo. Toma confirmada.');
    announce.mockRestore();
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
    expect(view.toJSON()).toBeNull();
  });
});
