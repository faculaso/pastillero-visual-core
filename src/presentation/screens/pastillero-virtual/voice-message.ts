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

  // `slotLabel` NO siempre es una ranura: cuando el tratamiento se cargó
  // desde el vademécum ANMAT, `SqliteMedicationVisualSuggestionProvider` le
  // mete la CONCENTRACIÓN ("250 MG"), y la app terminaba diciendo en voz
  // alta "Ranura del pastillero: 250 MG". Hasta que el dominio separe
  // ranura de concentración, acá se lee con un rótulo neutro que funciona
  // para los dos casos — mismo criterio que ya usa la notificación
  // (`buildDoseNotification` lo une con un guion, sin nombrarlo).
  if (dose.visualProfile.slotLabel) {
    sentences.push(`Referencia: ${dose.visualProfile.slotLabel}.`);
  }

  // Antes de la instrucción final, no después: quien escucha esto puede no
  // llegar a ver la tarjeta, así que el dato de quién se lo indicó tiene que
  // llegarle por voz igual que al resto.
  if (dose.caregiverName) {
    sentences.push(`Te lo indicó ${dose.caregiverName}.`);
  }

  sentences.push('Presioná el botón Confirmar Toma después de tomarla.');

  return sentences.join(' ');
}
