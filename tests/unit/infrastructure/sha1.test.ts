import { describe, it, expect } from 'vitest';
import { sha1Hex } from '../../../src/infrastructure/services/sha1';

/**
 * Se implementó SHA-1 a mano (ver el docblock del módulo), así que hay que
 * probarlo contra referencias externas. Los dos primeros son los vectores
 * oficiales de FIPS 180-1; el resto se calculó con el `crypto` de Node, que
 * es una implementación independiente de esta. Ninguno se escribió de
 * memoria: un SHA-1 sutilmente mal daría prefijos equivocados y el chequeo
 * de contraseñas filtradas diría "esta contraseña está limpia" sobre
 * cualquier cosa, en silencio y para siempre.
 */
describe('sha1Hex', () => {
  it('vectores oficiales de FIPS 180-1', () => {
    expect(sha1Hex('abc')).toBe('A9993E364706816ABA3E25717850C26C9CD0D89D');
    expect(sha1Hex('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')).toBe(
      '84983E441C3BD26EBAAE4AA1F95129E5E54670F1',
    );
  });

  it('la cadena vacía', () => {
    expect(sha1Hex('')).toBe('DA39A3EE5E6B4B0D3255BFEF95601890AFD80709');
  });

  it('el clásico del zorro', () => {
    expect(sha1Hex('The quick brown fox jumps over the lazy dog')).toBe(
      '2FD4E1C67A2D28FCED849EE1BB76E7391B93EB12',
    );
  });

  /** Cruza el borde de 55/56 bytes, que es donde el relleno agrega un bloque entero. */
  it('entradas largas: el relleno de bloque extra', () => {
    expect(sha1Hex('a'.repeat(55))).toBe('C1C8BBDC22796E28C0E15163D20899B65621D65A');
    expect(sha1Hex('a'.repeat(56))).toBe('C2DB330F6083854C99D4B5BFB6E8F29F201BE699');
    expect(sha1Hex('a'.repeat(1000))).toBe('291E9A6C66994949B57BA5E650361E98FC36B1BA');
  });

  it('acentos y emojis: UTF-8 de verdad, no charCodeAt a secas', () => {
    // Una contraseña con ñ o tilde es lo más esperable del mundo acá.
    expect(sha1Hex('contraseña')).toBe('8C31B65BDECDC9F18B695D7318186FD1FEED690D');
    expect(sha1Hex('🔒')).toBe('9A5903E2CD2DF47AAEB09B29149ADEC38C8B9E8E');
  });
});
