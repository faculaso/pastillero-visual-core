/**
 * SHA-1 en JavaScript puro.
 *
 * Se implementa acá en vez de sumar una dependencia porque el Core es una
 * librería que consume un proyecto host: cada dependencia nueva es una
 * instalación más que el host tiene que hacer. Y `crypto.subtle` no se
 * puede usar: en Hermes `crypto` a veces ni existe como global (ya nos
 * pasó, ver `CryptoIdGenerator`).
 *
 * SHA-1 está roto para firmas desde hace años, pero acá no se usa como
 * garantía de nada: es el algoritmo que la API de HaveIBeenPwned exige
 * para el prefijo de k-anonymity, y su rol es solamente agrupar. No se
 * está protegiendo nada con él.
 *
 * Verificado contra los vectores de prueba oficiales (FIPS 180-1).
 */
export function sha1Hex(text: string): string {
  const bytes = utf8Bytes(text);
  const bitLength = bytes.length * 8;

  // Relleno: un 1, ceros hasta dejar 8 bytes libres, y el largo en bits
  // como entero de 64 bits big-endian.
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  const high = Math.floor(bitLength / 0x100000000);
  const low = bitLength >>> 0;
  bytes.push((high >>> 24) & 0xff, (high >>> 16) & 0xff, (high >>> 8) & 0xff, high & 0xff);
  bytes.push((low >>> 24) & 0xff, (low >>> 16) & 0xff, (low >>> 8) & 0xff, low & 0xff);

  let h0 = 0x67452301;
  let h1 = 0xefcdab89;
  let h2 = 0x98badcfe;
  let h3 = 0x10325476;
  let h4 = 0xc3d2e1f0;

  const w = new Array<number>(80);

  for (let offset = 0; offset < bytes.length; offset += 64) {
    for (let i = 0; i < 16; i += 1) {
      const p = offset + i * 4;
      w[i] = ((bytes[p]! << 24) | (bytes[p + 1]! << 16) | (bytes[p + 2]! << 8) | bytes[p + 3]!) | 0;
    }
    for (let i = 16; i < 80; i += 1) {
      w[i] = rotateLeft(w[i - 3]! ^ w[i - 8]! ^ w[i - 14]! ^ w[i - 16]!, 1);
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;

    for (let i = 0; i < 80; i += 1) {
      let f: number;
      let k: number;
      if (i < 20) {
        f = (b & c) | (~b & d);
        k = 0x5a827999;
      } else if (i < 40) {
        f = b ^ c ^ d;
        k = 0x6ed9eba1;
      } else if (i < 60) {
        f = (b & c) | (b & d) | (c & d);
        k = 0x8f1bbcdc;
      } else {
        f = b ^ c ^ d;
        k = 0xca62c1d6;
      }
      const temp = (rotateLeft(a, 5) + f + e + k + w[i]!) | 0;
      e = d;
      d = c;
      c = rotateLeft(b, 30);
      b = a;
      a = temp;
    }

    h0 = (h0 + a) | 0;
    h1 = (h1 + b) | 0;
    h2 = (h2 + c) | 0;
    h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0;
  }

  return [h0, h1, h2, h3, h4].map(toHex8).join('').toUpperCase();
}

function rotateLeft(value: number, bits: number): number {
  return ((value << bits) | (value >>> (32 - bits))) | 0;
}

function toHex8(value: number): string {
  return (value >>> 0).toString(16).padStart(8, '0');
}

/**
 * UTF-8 a mano: `TextEncoder` tampoco está garantizado en Hermes. Se
 * reconstruyen los pares suplentes (emojis, por ejemplo) para que una
 * contraseña con caracteres fuera del plano básico hashee igual que en
 * cualquier otra implementación.
 */
function utf8Bytes(text: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < text.length; i += 1) {
    let code = text.charCodeAt(i);

    if (code >= 0xd800 && code <= 0xdbff && i + 1 < text.length) {
      const next = text.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        code = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00);
        i += 1;
      }
    }

    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0x10000) {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
    }
  }
  return bytes;
}
