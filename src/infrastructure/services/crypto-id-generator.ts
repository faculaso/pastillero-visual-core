import type { IdGenerator } from '../../application';

/**
 * `crypto.randomUUID()` está disponible en Hermes/RN moderno vía polyfill
 * (`react-native-get-random-values` + `expo-crypto`, u `op-sqlite`'s propio
 * helper) — pero ese polyfill es responsabilidad del proyecto HOST, y sin él
 * `crypto` ni siquiera existe como global (confirmado en dispositivo Android
 * real: "ReferenceError: Property 'crypto' doesn't exist", rompiendo el alta
 * de tratamiento y el guardado de fotos por igual, cualquier caller de
 * `generate()`). Se usa si está disponible, y si no, cae a un generador
 * UUID v4 puro en JS: estos ids son identificadores locales de entidades, no
 * tokens de seguridad, así que lo único que importa es unicidad, no que
 * `Math.random()` sea criptográficamente impredecible.
 */
export class CryptoIdGenerator implements IdGenerator {
  generate(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return generateUuidV4Fallback();
  }
}

function generateUuidV4Fallback(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = (Math.random() * 16) | 0;
    const value = character === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}
