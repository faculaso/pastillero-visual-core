import React, { useState } from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';

/** VisualProfileEditor renderiza BoxPhotoCaptureField, que importa react-native-image-picker (TS sin compilar). */
jest.mock('react-native-image-picker', () => ({
  __esModule: true,
  launchCamera: jest.fn().mockResolvedValue({ didCancel: true }),
  launchImageLibrary: jest.fn().mockResolvedValue({ didCancel: true }),
}));

import { VisualProfileEditor, type VisualProfileFormValue } from '../../src/presentation/screens/register-treatment/components/VisualProfileEditor';
import { PillShape } from '../../src/domain';
import { withProviders } from './test-utils';

const INITIAL: VisualProfileFormValue = {
  shape: PillShape.ROUND,
  color: '#FFFFFF',
  slotLabel: '',
  pillImageUrl: '',
  boxImageUrl: '',
};

function StatefulEditor({ onChangeSpy }: { onChangeSpy: (v: VisualProfileFormValue) => void }) {
  const [value, setValue] = useState(INITIAL);
  return (
    <VisualProfileEditor
      value={value}
      onChange={(v) => {
        setValue(v);
        onChangeSpy(v);
      }}
    />
  );
}

describe('VisualProfileEditor — selector de color', () => {
  it('expone los 6 colores pedidos como opciones tocables (no inputs de texto)', async () => {
    await render(withProviders(<StatefulEditor onChangeSpy={() => {}} />));

    for (const label of ['Rojo', 'Azul', 'Amarillo', 'Verde', 'Blanco', 'Violeta']) {
      expect(screen.getByLabelText(label)).toBeTruthy();
    }
  });

  it('tocar un color actualiza el formulario con ese hex', async () => {
    const onChangeSpy = jest.fn();
    const user = userEvent.setup();
    await render(withProviders(<StatefulEditor onChangeSpy={onChangeSpy} />));

    await user.press(screen.getByLabelText('Azul'));

    expect(onChangeSpy).toHaveBeenCalledWith(expect.objectContaining({ color: '#2D9CDB' }));
  });

  it('marca el color seleccionado con accessibilityState.checked', async () => {
    const user = userEvent.setup();
    await render(withProviders(<StatefulEditor onChangeSpy={() => {}} />));

    await user.press(screen.getByLabelText('Verde'));

    expect(screen.getByLabelText('Verde').props.accessibilityState.checked).toBe(true);
    expect(screen.getByLabelText('Rojo').props.accessibilityState.checked).toBe(false);
  });
});
