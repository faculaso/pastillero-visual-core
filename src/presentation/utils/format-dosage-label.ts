import { MeasurementUnit } from '../../domain';
import type { Dosage } from '../../domain';

const UNIT_LABELS: Record<MeasurementUnit, string> = {
  [MeasurementUnit.MG]: 'miligramos',
  [MeasurementUnit.MCG]: 'microgramos',
  [MeasurementUnit.G]: 'gramos',
  [MeasurementUnit.ML]: 'mililitros',
  [MeasurementUnit.UI]: 'unidades internacionales',
  [MeasurementUnit.UNIT]: 'comprimido(s)',
};

/**
 * Copia deliberada de la de `infrastructure/services/notifee/format-dosage-label.ts`
 * (esa usa abreviaturas como "mg" para el cuerpo de una notificación
 * compacta; esta usa palabras completas, mejor para TTS — "mg" se lee mal
 * en voz alta). No se comparte código entre ambas a propósito: presentación
 * no puede importar infraestructura (regla de dependencia de la
 * arquitectura), y la infra tampoco debería depender de presentación. Son
 * ~10 líneas cada una — la duplicación es más barata que romper la capa.
 */
export function formatDosageLabelForSpeech(dosage: Dosage): string {
  return `${dosage.amount} ${UNIT_LABELS[dosage.unit]}`;
}
