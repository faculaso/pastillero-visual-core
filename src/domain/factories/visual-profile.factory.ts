import { Ok, Err, type Result } from '../core/result';
import { DomainErrors, type DomainError } from '../errors/domain.errors';
import { PillShape } from '../enums/dose.enums';
import type { VisualProfile } from '../entities/visual-profile.entity';

const HEX_COLOR_REGEX = /^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$/;

/**
 * Invariante del perfil visual (CU-01 pasos 6-7, RF-02):
 * - `color` debe ser un hex válido (#RGB o #RRGGBB).
 * - `secondaryColor`, si viene, también debe ser un hex válido.
 * - `shape = CAPSULE_BICOLOR` requiere `secondaryColor` (si no, no hay nada
 *   que diferencie la mitad "secundaria" de la cápsula — se degradaría en
 *   silencio a una CAPSULE de un solo color).
 *
 * La foto (comprimido/caja) o modelo 3D es OPCIONAL: sin ninguna, `PillVisual`
 * ya dibuja un fallback geométrico fiel (forma + color) — ver su docblock.
 * Exigir una foto acá forzaría al Cuidador a fotografiar la caja antes de
 * poder guardar un tratamiento, aunque el reconocimiento visual (forma+color)
 * ya funcione sin ella.
 */
export function createVisualProfile(
  input: VisualProfile,
): Result<VisualProfile, DomainError> {
  if (!HEX_COLOR_REGEX.test(input.color)) {
    return Err(DomainErrors.validation(`Color hex inválido: ${input.color}`));
  }

  if (input.secondaryColor !== undefined && !HEX_COLOR_REGEX.test(input.secondaryColor)) {
    return Err(DomainErrors.validation(`Color secundario hex inválido: ${input.secondaryColor}`));
  }

  if (input.shape === PillShape.CAPSULE_BICOLOR && input.secondaryColor === undefined) {
    return Err(DomainErrors.validation('La forma cápsula bicolor requiere un color secundario'));
  }

  return Ok(input);
}
