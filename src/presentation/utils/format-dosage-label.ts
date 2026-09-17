import { MeasurementUnit } from '../../domain';
import type { Dosage } from '../../domain';

const UNIT_LABELS: Record<MeasurementUnit, string> = {
  [MeasurementUnit.MG]: 'miligramos',
  [MeasurementUnit.MCG]: 'microgramos',
  [MeasurementUnit.G]: 'gramos',
  [MeasurementUnit.ML]: 'mililitros',
  [MeasurementUnit.UI]: 'unidades internacionales',
  [MeasurementUnit.UNIT]: 'comprimidos',
};

/**
 * Solo `UNIT` se pluraliza: las unidades de medida ("miligramos") ya van
 * siempre en plural aunque la cantidad sea 1, pero "1 comprimidos" suena
 * mal — y peor leído por TTS, que es el consumidor de esta función.
 */
const UNIT_LABELS_SINGULAR: Partial<Record<MeasurementUnit, string>> = {
  [MeasurementUnit.UNIT]: 'comprimido',
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
  const label = (dosage.amount === 1 ? UNIT_LABELS_SINGULAR[dosage.unit] : undefined) ?? UNIT_LABELS[dosage.unit];
  return `${dosage.amount} ${label}`;
}
