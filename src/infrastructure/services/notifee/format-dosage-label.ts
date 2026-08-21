import { MeasurementUnit } from '../../../domain';
import type { Dosage } from '../../../domain';

const UNIT_LABELS: Record<MeasurementUnit, string> = {
  [MeasurementUnit.MG]: 'mg',
  [MeasurementUnit.MCG]: 'mcg',
  [MeasurementUnit.G]: 'g',
  [MeasurementUnit.ML]: 'ml',
  [MeasurementUnit.UI]: 'UI',
  [MeasurementUnit.UNIT]: 'comprimido(s)',
};

/** "1 comprimido(s)", "500 mg" — texto legible para el cuerpo de la notificación. */
export function formatDosageLabel(dosage: Dosage): string {
  return `${dosage.amount} ${UNIT_LABELS[dosage.unit]}`;
}
