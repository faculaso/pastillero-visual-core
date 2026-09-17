import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SnapshotCache } from '../../application';

const PREFIX = 'snapshot:';

/**
 * `Date` no sobrevive a `JSON.stringify` — se serializa como texto ISO y al
 * volver sería un `string`, que rompería en silencio cualquier
 * `.getTime()` del dominio. Este reviver las reconstruye.
 *
 * Reconoce SOLO el formato ISO completo con zona horaria (lo que emite
 * `Date.prototype.toJSON`), no cualquier texto que empiece con números.
 * En este dominio todo campo con esa forma exacta es una fecha; ninguno es
 * texto cargado por una persona.
 */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

function reviveDates(_key: string, value: unknown): unknown {
  if (typeof value === 'string' && ISO_DATE.test(value)) return new Date(value);
  return value;
}

/**
 * Respaldo de lecturas sobre AsyncStorage. Se elige AsyncStorage y no la
 * base SQLite a propósito: esto guarda RESPUESTAS completas, no filas de
 * tablas relacionales, así que no hay que mantener un esquema espejo ni
 * resolver choques de ids con lo que ya vive local.
 *
 * Nada de lo que se guarda acá es fuente de verdad: si Supabase responde,
 * su respuesta pisa el respaldo.
 */
export class AsyncStorageSnapshotCache implements SnapshotCache {
  async read<T>(key: string): Promise<T | null> {
    try {
      const raw = await AsyncStorage.getItem(PREFIX + key);
      if (raw === null) return null;
      return JSON.parse(raw, reviveDates) as T;
    } catch {
      // Un respaldo ilegible no puede tumbar la pantalla: se comporta como
      // si no hubiera respaldo y el error remoto original sigue su curso.
      return null;
    }
  }

  async write<T>(key: string, value: T): Promise<void> {
    try {
      await AsyncStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
      // Guardar es best-effort: quedarse sin espacio no debe romper una
      // lectura que ya salió bien.
    }
  }
}
