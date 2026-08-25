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

  it('acepta un perfil sin ningún asset visual (usa el fallback de forma + color)', () => {
    const result = createVisualProfile({ shape: PillShape.ROUND, color: '#FFFFFF' });
    expect(result.ok).toBe(true);
  });

  it('acepta un perfil que solo tenga model3dUrl', () => {
    const result = createVisualProfile({
      shape: PillShape.CAPSULE,
      color: '#00FF00',
      model3dUrl: 'https://example.com/pill.glb',
    });
    expect(result.ok).toBe(true);
  });

  it('acepta CAPSULE_BICOLOR con color y secondaryColor válidos', () => {
    const result = createVisualProfile({
      shape: PillShape.CAPSULE_BICOLOR,
      color: '#EB5757',
      secondaryColor: '#FFFFFF',
    });
    expect(result.ok).toBe(true);
  });

  it('rechaza CAPSULE_BICOLOR sin secondaryColor', () => {
    const result = createVisualProfile({ shape: PillShape.CAPSULE_BICOLOR, color: '#EB5757' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('VALIDATION_ERROR');
  });

  it('rechaza secondaryColor con formato hex inválido', () => {
    const result = createVisualProfile({
      shape: PillShape.CAPSULE_BICOLOR,
      color: '#EB5757',
      secondaryColor: 'no-es-un-hex',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('VALIDATION_ERROR');
  });
});
