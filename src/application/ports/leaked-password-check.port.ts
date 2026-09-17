import type { Result, DomainError } from '../../domain';

/**
 * ¿Esta contraseña ya apareció en una filtración conocida?
 *
 * Supabase trae esto de fábrica, pero solo en Plan Pro. Se implementa del
 * lado de la app para no atar una medida de seguridad básica a una decisión
 * de facturación.
 *
 * Es un chequeo del LADO DEL CLIENTE, y eso está bien para lo que hace: el
 * riesgo real es el propio usuario eligiendo una contraseña que ya está en
 * todos los diccionarios, no un atacante esquivando una validación (para
 * eso llamaría a la API de Supabase directamente y ya). No es una defensa
 * perimetral; es ayudar a la persona a elegir mejor.
 */
export interface LeakedPasswordCheck {
  /** `true` = la contraseña figura en filtraciones conocidas. */
  isLeaked(password: string): Promise<Result<boolean, DomainError>>;
}
