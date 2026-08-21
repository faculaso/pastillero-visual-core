import { PillShape } from '../enums/dose.enums';

/**
 * VisualProfile: parametrización visual editada por el cuidador en CU-01
 * pasos 6-7. Es parte del agregado `Treatment` (no tiene ciclo de vida
 * propio), pero se modela por separado para mantener responsabilidad única
 * y facilitar el testing del configurador visual de forma aislada.
 */
export interface VisualProfile {
  readonly shape: PillShape;
  readonly color: string; // hex, ej. "#FFFFFF"
  readonly pillImageUrl?: string; // foto/asset 2D del comprimido
  readonly boxImageUrl?: string; // foto de la caja/envase real
  readonly model3dUrl?: string; // asset 3D opcional (glTF/GLB)
  readonly slotLabel?: string; // ranura asignada en el pastillero físico/virtual
}
