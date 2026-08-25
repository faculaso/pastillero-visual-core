import { PillShape } from '../../domain';

export const PILL_SHAPE_LABELS: Record<PillShape, string> = {
  [PillShape.ROUND]: 'Redonda',
  [PillShape.OVAL]: 'Ovalada',
  [PillShape.CAPSULE]: 'Cápsula',
  [PillShape.CAPSULE_BICOLOR]: 'Cápsula bicolor',
  [PillShape.RECTANGULAR]: 'Rectangular',
  [PillShape.TRIANGULAR]: 'Triangular',
  [PillShape.OTHER]: 'Otra',
};
