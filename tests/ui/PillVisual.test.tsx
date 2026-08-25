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

  it('ROUND dibuja un círculo (rx === ry) y OVAL una elipse alargada (rx > ry) — antes eran indistinguibles', async () => {
    const round = await render(<PillVisual visualProfile={{ shape: PillShape.ROUND, color: '#FF0000' }} size={100} />);
    const oval = await render(<PillVisual visualProfile={{ shape: PillShape.OVAL, color: '#FF0000' }} size={100} />);

    const roundEllipse = findMainEllipse(round.toJSON());
    const ovalEllipse = findMainEllipse(oval.toJSON());

    expect(roundEllipse.rx).toBe(roundEllipse.ry);
    expect(ovalEllipse.rx).toBeGreaterThan(ovalEllipse.ry);
    expect(ovalEllipse).not.toEqual(roundEllipse);
  });

  it('OTHER dibuja un hexágono, no una variación de RECTANGULAR', async () => {
    const other = await render(<PillVisual visualProfile={{ shape: PillShape.OTHER, color: '#FF0000' }} size={100} />);
    const rectangular = await render(
      <PillVisual visualProfile={{ shape: PillShape.RECTANGULAR, color: '#FF0000' }} size={100} />,
    );

    // `Polygon` de react-native-svg se renderiza internamente como `RNSVGPath` (no hay `RNSVGPolygon`).
    expect(findNodeType(other.toJSON(), 'RNSVGPath')).toBeTruthy();
    expect(findNodeType(rectangular.toJSON(), 'RNSVGPath')).toBeNull();
  });
});

interface JsonNode {
  readonly type: string;
  readonly props?: Record<string, unknown>;
  readonly children?: readonly (JsonNode | string)[] | null;
}

/** Primer `RNSVGEllipse` del árbol — es el cuerpo de la pastilla, no el brillo especular (segunda elipse). */
function findMainEllipse(tree: unknown): { rx: number; ry: number } {
  const node = findNode(tree, 'RNSVGEllipse');
  if (!node) throw new Error('No se encontró ningún RNSVGEllipse en el árbol renderizado');
  return { rx: node.props?.rx as number, ry: node.props?.ry as number };
}

function findNodeType(tree: unknown, type: string): JsonNode | null {
  return findNode(tree, type);
}

function findNode(tree: unknown, type: string): JsonNode | null {
  const stack: JsonNode[] = Array.isArray(tree) ? [...tree] : tree ? [tree as JsonNode] : [];
  while (stack.length > 0) {
    const node = stack.shift() as JsonNode;
    if (node.type === type) return node;
    if (node.children) stack.push(...(node.children.filter((c): c is JsonNode => typeof c !== 'string')));
  }
  return null;
}
