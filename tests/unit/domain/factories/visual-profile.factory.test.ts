import { describe, it, expect } from 'vitest';
import { createVisualProfile, PillShape } from '../../../../src/domain';

describe('createVisualProfile', () => {
  it('acepta un perfil con color hex válido y al menos un asset visual', () => {
    const result = createVisualProfile({
      shape: PillShape.ROUND,
      color: '#FFFFFF',
      pillImageUrl: 'https://example.com/pill.png',
    });
    expect(result.ok).toBe(true);
  });

  it.each(['FFFFFF', '#GGGGGG', '#FFF0', 'red'])('rechaza color inválido: %s', (color) => {
    const result = createVisualProfile({
      shape: PillShape.ROUND,
      color,
      pillImageUrl: 'https://example.com/pill.png',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('VALIDATION_ERROR');
  });

  it('rechaza un perfil sin ningún asset visual', () => {
    const result = createVisualProfile({ shape: PillShape.ROUND, color: '#FFFFFF' });
    expect(result.ok).toBe(false);
  });

  it('acepta un perfil que solo tenga model3dUrl', () => {
    const result = createVisualProfile({
      shape: PillShape.CAPSULE,
      color: '#00FF00',
      model3dUrl: 'https://example.com/pill.glb',
    });
    expect(result.ok).toBe(true);
  });
});
