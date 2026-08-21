/**
 * Result<T, E> — contrato base para toda operación de dominio que pueda fallar.
 * Se evita el uso de `throw` en los contratos de repositorio para forzar al
 * caller (casos de uso) a manejar explícitamente el camino de error.
 */
export type Result<T, E = DomainError> = Readonly<Ok<T>> | Readonly<Fail<E>>;

interface Ok<T> {
  readonly ok: true;
  readonly value: T;
}

interface Fail<E> {
  readonly ok: false;
  readonly error: E;
}

export const Ok = <T>(value: T): Result<T, never> => ({ ok: true, value });

export const Err = <E>(error: E): Result<never, E> => ({ ok: false, error });

/** Type guard utilitario para narrowing en callers. */
export function isOk<T, E>(result: Result<T, E>): result is Readonly<Ok<T>> {
  return result.ok === true;
}

export function isErr<T, E>(result: Result<T, E>): result is Readonly<Fail<E>> {
  return result.ok === false;
}

// Import diferido para evitar dependencia circular en el archivo de errores.
import type { DomainError } from '../errors/domain.errors';
