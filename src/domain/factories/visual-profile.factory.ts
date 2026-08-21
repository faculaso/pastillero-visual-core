import { Ok, Err, type Result } from '../core/result';
import { DomainErrors, type DomainError } from '../errors/domain.errors';
import type { VisualProfile } from '../entities/visual-profile.entity';

const HEX_COLOR_REGEX = /^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$/;

/**
 * Invariantes del perfil visual (CU-01 pasos 6-7, RF-02):
 * - `color` debe ser un hex válido (#RGB o #RRGGBB).
 * - Debe existir al menos una referencia visual (foto de comprimido, de caja
 *   o modelo 3D) — un perfil sin ningún activo visual rompe el propósito
 *   central del sistema (reconocimiento visual para adultos mayores).
 */
export function createVisualProfile(
  input: VisualProfile,
): Result<VisualProfile, DomainError> {
  if (!HEX_COLOR_REGEX.test(input.color)) {
    return Err(DomainErrors.validation(`Color hex inválido: ${input.color}`));
  }

  const hasVisualAsset = Boolean(
    input.pillImageUrl || input.boxImageUrl || input.model3dUrl,
  );
  if (!hasVisualAsset) {
    return Err(
      DomainErrors.validation(
        'El perfil visual requiere al menos una foto (comprimido/caja) o modelo 3D',
      ),
    );
  }

  return Ok(input);
}
