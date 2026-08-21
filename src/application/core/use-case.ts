import type { Result } from '../../domain';
import type { DomainError } from '../../domain';

/**
 * Contrato uniforme para todos los casos de uso: entrada tipada, salida
 * envuelta en `Result`. Permite testear cada UseCase mockeando solo sus
 * dependencias inyectadas (repos/ports), sin tocar infraestructura real.
 */
export interface UseCase<TInput, TOutput> {
  execute(input: TInput): Promise<Result<TOutput, DomainError>>;
}
