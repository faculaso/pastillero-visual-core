import { describe, it, expect } from 'vitest';
import { inferImageExtension, stripFileUriScheme } from '../../../../src/infrastructure/services/image-storage/image-path.utils';

describe('inferImageExtension', () => {
  it('extrae la extensión en minúsculas', () => {
    expect(inferImageExtension('/tmp/foo/bar.PNG')).toBe('png');
    expect(inferImageExtension('file:///cache/img.jpeg')).toBe('jpeg');
  });

  it('ignora query strings', () => {
    expect(inferImageExtension('content://media/external/images/1.jpg?x=123')).toBe('jpg');
  });

  it('default a jpg si no hay extensión reconocible', () => {
    expect(inferImageExtension('content://media/external/images/media/999')).toBe('jpg');
  });
});

describe('stripFileUriScheme', () => {
  it('quita el prefijo file:// si está presente', () => {
    expect(stripFileUriScheme('file:///data/user/0/app/files/img.jpg')).toBe('/data/user/0/app/files/img.jpg');
  });

  it('deja el path sin cambios si no tiene el prefijo', () => {
    expect(stripFileUriScheme('/data/user/0/app/files/img.jpg')).toBe('/data/user/0/app/files/img.jpg');
  });
});
