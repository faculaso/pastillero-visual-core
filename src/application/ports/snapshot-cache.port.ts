/**
 * Guarda la última respuesta buena de una lectura remota, para poder
 * servirla cuando no hay red.
 *
 * Existe porque los contratos del dominio prometen algo que la app no
 * cumplía. `DoseRepository` dice "operación crítica offline-first: debe
 * poder ejecutarse sin red" y `TreatmentRepository` dice "offline-first
 * debe escribir primero a almacenamiento local" — pero `bootstrap` cablea
 * tratamientos, dosis y stock directo a Supabase. Sin conexión la pantalla
 * quedaba en blanco: sonaba la alarma, el adulto mayor abría la app, y no
 * había ni qué pastilla tomar ni forma de confirmarla.
 *
 * Es deliberadamente un caché de LECTURA, no un motor de sincronización.
 * Supabase sigue siendo la fuente de verdad; esto solo evita que perder la
 * conexión signifique perder el pastillero. Escribir sin red (confirmar una
 * toma offline y reenviarla después) es un problema aparte y más grande.
 */
export interface SnapshotCache {
  read<T>(key: string): Promise<T | null>;
  write<T>(key: string, value: T): Promise<void>;
}
