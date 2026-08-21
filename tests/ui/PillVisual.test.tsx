import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { PillVisual } from '../../src/presentation/screens/pastillero-virtual/components/PillVisual';
import { PillShape } from '../../src/domain';

describe('PillVisual', () => {
  it('renderiza el fallback de forma+color cuando no hay ninguna imagen', async () => {
    const view = await render(<PillVisual visualProfile={{ shape: PillShape.ROUND, color: '#FF0000' }} />);
    const tree = view.toJSON();
    expect(tree).toBeTruthy();
    expect(JSON.stringify(tree)).not.toContain('"type":"Image"');
  });

  it('renderiza una imagen cuando pillImageUrl está presente', async () => {
    const view = await render(
      <PillVisual visualProfile={{ shape: PillShape.ROUND, color: '#FFFFFF', pillImageUrl: 'https://example.com/p.png' }} />,
    );
    expect(JSON.stringify(view.toJSON())).toContain('example.com/p.png');
  });

  it('renderiza la foto real de la caja (URI local persistente) cuando no hay pillImageUrl', async () => {
    const localUri = 'file:///data/user/0/com.pastillero/files/box-images/abc123.jpg';
    const view = await render(
      <PillVisual visualProfile={{ shape: PillShape.ROUND, color: '#FFFFFF', boxImageUrl: localUri }} />,
    );
    expect(JSON.stringify(view.toJSON())).toContain(localUri);
  });

  it('prioriza pillImageUrl sobre boxImageUrl si ambas están presentes', async () => {
    const view = await render(
      <PillVisual
        visualProfile={{
          shape: PillShape.ROUND,
          color: '#FFFFFF',
          pillImageUrl: 'file:///pill.jpg',
          boxImageUrl: 'file:///box.jpg',
        }}
      />,
    );
    const json = JSON.stringify(view.toJSON());
    expect(json).toContain('pill.jpg');
    expect(json).not.toContain('box.jpg');
  });

  it('si la imagen de la caja falla al cargar (archivo borrado externamente), cae al fallback geométrico', async () => {
    await render(
      <PillVisual visualProfile={{ shape: PillShape.ROUND, color: '#00FF00', boxImageUrl: 'file:///no-existe.jpg' }} />,
    );

    fireEvent(screen.getByRole('image'), 'error');

    // Tras el error, ya no debería quedar ningún <Image> en el árbol.
    await waitFor(() => expect(JSON.stringify(screen.toJSON())).not.toContain('no-existe.jpg'));
  });

  it('usa el nombre del medicamento en el accessibilityLabel cuando se provee', async () => {
    await render(
      <PillVisual
        visualProfile={{ shape: PillShape.ROUND, color: '#FFFFFF', boxImageUrl: 'file:///box.jpg' }}
        medicationName="Paracetamol"
      />,
    );
    expect(screen.getByLabelText('Foto del envase de Paracetamol')).toBeTruthy();
  });

  it('usa un label genérico cuando no se provee el nombre del medicamento', async () => {
    await render(<PillVisual visualProfile={{ shape: PillShape.ROUND, color: '#FFFFFF' }} />);
    expect(screen.getByLabelText('Representación de la forma y color del comprimido')).toBeTruthy();
  });
});
