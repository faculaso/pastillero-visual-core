import { PillShape } from '../../../../domain';

/**
 * Tabla de mapeo ANMAT -> dominio. Vive en infraestructura porque el
 * vocabulario de entrada (`forma_farmaceutica` en español, con la
 * variabilidad de texto libre típica de un dataset gubernamental) es
 * específico de esta fuente de datos — el dominio solo conoce `PillShape`,
 * nunca "COMPRIMIDOS RECUBIERTOS".
 *
 * Estrategia: normalizar (mayúsculas, sin tildes) y buscar por
 * coincidencia de substring contra palabras clave, de más específica a
 * más genérica — "CAPSULA BLANDA" y "COMPRIMIDO RECUBIERTO" son formas
 * reales del dataset que hay que cubrir antes de caer al default.
 */
const KEYWORD_TO_SHAPE: ReadonlyArray<readonly [string, PillShape]> = [
  ['CAPSULA', PillShape.CAPSULE],
  ['GRAGEA', PillShape.OVAL],
  ['OVALO', PillShape.OVAL],
  ['COMPRIMIDO', PillShape.ROUND],
  ['TABLETA', PillShape.ROUND],
  ['PASTILLA', PillShape.ROUND],
];

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quita tildes/diacríticos
    .toUpperCase()
    .trim();
}

/**
 * Retorna `PillShape.OTHER` para formas no mapeadas (soluciones inyectables,
 * jarabes, cremas, etc. — formas sin "pastilla" física que dibujar) en vez
 * de fallar: el Cuidador siempre puede corregir la forma manualmente en el
 * configurador visual, esto es una SUGERENCIA, no una fuente de verdad.
 */
export function mapFormaFarmaceuticaToPillShape(formaFarmaceutica: string | null | undefined): PillShape {
  if (!formaFarmaceutica) return PillShape.OTHER;
  const normalized = normalize(formaFarmaceutica);

  for (const [keyword, shape] of KEYWORD_TO_SHAPE) {
    if (normalized.includes(keyword)) return shape;
  }
  return PillShape.OTHER;
}
