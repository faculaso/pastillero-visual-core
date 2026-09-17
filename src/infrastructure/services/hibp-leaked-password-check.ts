import { Ok, Err, type Result, DomainErrors, type DomainError } from '../../domain';
import type { LeakedPasswordCheck } from '../../application';
import { sha1Hex } from './sha1';

const RANGE_ENDPOINT = 'https://api.pwnedpasswords.com/range/';

/**
 * Registrarse no puede quedar colgado esperando a un servicio de terceros.
 * Cinco segundos y se sigue de largo (ver la política de fail-open abajo).
 */
const TIMEOUT_MS = 5_000;

/**
 * Chequeo contra HaveIBeenPwned usando k-anonymity — el mismo servicio que
 * usa Supabase por detrás en su Plan Pro.
 *
 * CÓMO PRESERVA LA PRIVACIDAD, que es lo que hace aceptable mandar algo
 * derivado de una contraseña a un tercero: se calcula el SHA-1 y se envían
 * SOLO los primeros 5 caracteres hexadecimales. El servidor devuelve todos
 * los finales de hash que empiezan con ese prefijo (del orden de 500 a
 * 1.000) y la comparación ocurre acá, en el teléfono. La contraseña nunca
 * sale del dispositivo, ni completa ni hasheada.
 *
 * El header `Add-Padding` pide que la respuesta se rellene con entradas
 * falsas de conteo cero, para que ni el TAMAÑO de la respuesta insinúe
 * cuántos hashes reales tenía ese prefijo. Por eso las entradas con conteo
 * cero se descartan al parsear: son relleno, no filtraciones.
 *
 * FAIL-OPEN a propósito: si no hay red, o HIBP está caído, o responde algo
 * raro, se devuelve el error y quien llama sigue adelante con el registro.
 * Dejar a una persona sin poder crear su cuenta porque un servicio ajeno no
 * contesta es peor que aceptarle una contraseña mediocre — más todavía en
 * esta app, donde la cuenta es de un adulto mayor que quizás la está
 * creando con ayuda de alguien que vino un rato.
 */
export class HibpLeakedPasswordCheck implements LeakedPasswordCheck {
  async isLeaked(password: string): Promise<Result<boolean, DomainError>> {
    const hash = sha1Hex(password);
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(`${RANGE_ENDPOINT}${prefix}`, {
        headers: { 'Add-Padding': 'true' },
        signal: controller.signal,
      });
      if (!response.ok) {
        return Err(DomainErrors.repositoryFailure(new Error(`HIBP respondió ${response.status}`)));
      }
      return Ok(suffixAparece(await response.text(), suffix));
    } catch (cause) {
      return Err(DomainErrors.repositoryFailure(cause));
    } finally {
      clearTimeout(timer);
    }
  }
}

/**
 * El cuerpo viene como líneas `FINALDEHASH:CANTIDAD`. Las de cantidad cero
 * son el relleno que pedimos con `Add-Padding` y no cuentan como filtración.
 */
function suffixAparece(body: string, suffix: string): boolean {
  for (const line of body.split('\n')) {
    const [candidato, cantidad] = line.trim().split(':');
    if (!candidato) continue;
    if (candidato.toUpperCase() !== suffix.toUpperCase()) continue;
    return Number(cantidad ?? '0') > 0;
  }
  return false;
}
