import type { IdGenerator } from '../../application';

/**
 * `crypto.randomUUID()` está disponible en Hermes/RN moderno vía polyfill
 * (`react-native-get-random-values` + `expo-crypto`, u `op-sqlite`'s propio
 * helper). Se aísla acá para poder cambiar de estrategia sin tocar use cases.
 */
export class CryptoIdGenerator implements IdGenerator {
  generate(): string {
    return crypto.randomUUID();
  }
}
