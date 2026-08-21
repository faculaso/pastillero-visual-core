import type { PendingDoseView } from '../../../application';
import { formatDosageLabelForSpeech } from '../../utils/format-dosage-label';
import { PILL_SHAPE_LABELS } from '../../utils/pill-shape-labels';

/**
 * CU-02: "Escuchar indicaciones" — lee nombre del medicamento, dosis,
 * forma y la instrucción de toma. Función pura (sin `react-native`, sin
 * side effects) para poder testearla en Vitest sin el runner de Jest.
 *
 * Frases cortas y separadas por punto, no una sola oración larga — un TTS
 * pausado (ver `ReactNativeTtsService`) ya ralentiza el ritmo; frases
 * cortas evitan que además suene como un párrafo corrido difícil de seguir.
 */
export function buildDoseVoiceMessage(dose: PendingDoseView): string {
  const shapeLabel = PILL_SHAPE_LABELS[dose.visualProfile.shape].toLowerCase();
  const dosageLabel = formatDosageLabelForSpeech(dose.dosagePerTake);

  const sentences = [
    `Es hora de tomar ${dose.medicationName}.`,
    `Dosis: ${dosageLabel}.`,
    `Forma del comprimido: ${shapeLabel}.`,
  ];

  if (dose.visualProfile.slotLabel) {
    sentences.push(`Ranura del pastillero: ${dose.visualProfile.slotLabel}.`);
  }

  sentences.push('Presioná el botón Confirmar Toma después de tomarla.');

  return sentences.join(' ');
}
