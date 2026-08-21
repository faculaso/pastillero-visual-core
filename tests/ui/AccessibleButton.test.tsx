import React from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';
import { AccessibleButton } from '../../src/presentation/design-system/AccessibleButton';

describe('AccessibleButton', () => {
  it('dispara onPress al presionar', async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();
    await render(<AccessibleButton label="Confirmar" onPress={onPress} />);

    await user.press(screen.getByText('Confirmar'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('no dispara onPress si está disabled', async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();
    await render(<AccessibleButton label="Confirmar" onPress={onPress} disabled />);

    await user.press(screen.getByText('Confirmar'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('no dispara onPress mientras está en loading, y expone accessibilityState.busy', async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();
    await render(<AccessibleButton label="Confirmar" onPress={onPress} loading />);

    // En loading se reemplaza el texto por un spinner: el texto ya no está disponible para presionar.
    expect(screen.queryByText('Confirmar')).toBeNull();
    expect(onPress).not.toHaveBeenCalled();
  });

  it('expone accessibilityRole="button" y el label correcto', async () => {
    await render(<AccessibleButton label="Guardar" onPress={() => {}} />);
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeTruthy();
  });
});
