import { MeasurementUnit } from '../../../../domain';

export interface SuggestedStock {
  readonly quantity: number;
  readonly unit: MeasurementUnit;
}

/**
 * `presentacion_unidades` de ANMAT es texto libre gubernamental, ej.
 * "ENVASE CONTENIENDO 30 COMPRIMIDOS", "CAJA X 20 CAPSULAS",
 * "FRASCO AMPOLLA X 1", "ENVASE CONTENIENDO 100 ML". Se extrae el primer
 * número presente como cantidad sugerida — es una sugerencia de arranque
 * para el formulario (CU-01 paso 8), no una validación: el Cuidador
 * siempre puede corregirla antes de guardar.
 *
 * Retorna `null` cuando el texto no trae ningún número reconocible —
 * preferible a inventar un valor (ej. "FRASCO GOTERO", sin cantidad
 * explícita) que silenciosamente confunda al Cuidador.
 */
export function suggestInitialStockFromPresentacion(
  presentacionUnidades: string | null | undefined,
): SuggestedStock | null {
  if (!presentacionUnidades) return null;

  const match = presentacionUnidades.match(/(\d+(?:[.,]\d+)?)/);
  if (!match) return null;

  const quantity = Number(match[1]!.replace(',', '.'));
  if (!Number.isFinite(quantity) || quantity <= 0) return null;

  return { quantity, unit: inferUnit(presentacionUnidades) };
}

function inferUnit(text: string): MeasurementUnit {
  const upper = text.toUpperCase();
  if (upper.includes('ML')) return MeasurementUnit.ML;
  if (upper.includes(' MG') || upper.endsWith('MG')) return MeasurementUnit.MG;
  // Comprimidos, cápsulas, ampollas, etc. — la unidad de stock es "unidades sueltas".
  return MeasurementUnit.UNIT;
}
