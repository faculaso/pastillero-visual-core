import { Ok, Err, type Result, DomainErrors, type DomainError } from '../../../../domain';

/**
 * Fila cruda tal como viene del CSV del Vademécum Nacional de ANMAT
 * (columnas exactas del dataset abierto). Todo `string` porque un CSV no
 * tiene tipos — la validación de contenido ocurre en `parseAnmatCsvRow`.
 */
export interface AnmatCsvRow {
  readonly nro_certificado?: string;
  readonly nombre_comercial?: string;
  readonly generico_droga?: string;
  readonly forma_farmaceutica?: string;
  readonly concentracion?: string;
  readonly presentacion_unidades?: string;
  readonly laboratorio?: string;
  readonly [key: string]: string | undefined; // el dataset real trae más columnas que ignoramos
}

/** Registro ya validado, listo para insertar (columnas = nombres de columna SQL, no de dominio). */
export interface AnmatMedicationRecord {
  readonly id: string;
  readonly nroCertificado: string;
  readonly nombreComercial: string;
  readonly genericoDroga: string;
  readonly formaFarmaceutica: string;
  readonly concentracion: string;
  readonly presentacionUnidades: string;
  readonly laboratorio: string;
  /** Descripción compuesta para el campo genérico `presentation` (compatibilidad con Medication de dominio). */
  readonly presentationDisplay: string;
}

const REQUIRED_FIELDS = ['nro_certificado', 'nombre_comercial', 'generico_droga', 'laboratorio'] as const;

/**
 * Valida que una fila cruda tenga los campos mínimos indispensables. El
 * dataset de ANMAT tiene filas incompletas/mal cargadas en la práctica —
 * se descartan explícitamente (`Err`) en vez de insertar registros a
 * medias que después rompan una búsqueda o el configurador visual.
 */
export function parseAnmatCsvRow(row: AnmatCsvRow): Result<AnmatMedicationRecord, DomainError> {
  const missing = REQUIRED_FIELDS.filter((field) => !row[field]?.trim());
  if (missing.length > 0) {
    return Err(DomainErrors.validation(`Fila ANMAT incompleta, faltan: ${missing.join(', ')}`));
  }

  const nroCertificado = row.nro_certificado!.trim();
  const nombreComercial = row.nombre_comercial!.trim();
  const genericoDroga = row.generico_droga!.trim();
  const laboratorio = row.laboratorio!.trim();
  const formaFarmaceutica = (row.forma_farmaceutica ?? '').trim();
  const concentracion = (row.concentracion ?? '').trim();
  const presentacionUnidades = (row.presentacion_unidades ?? '').trim();

  return Ok({
    id: buildDeterministicId(nroCertificado, concentracion, presentacionUnidades),
    nroCertificado,
    nombreComercial,
    genericoDroga,
    formaFarmaceutica,
    concentracion,
    presentacionUnidades,
    laboratorio,
    presentationDisplay: composePresentationDisplay(formaFarmaceutica, concentracion, presentacionUnidades),
  });
}

/**
 * Un mismo `nro_certificado` puede cubrir varias presentaciones/concentraciones
 * del mismo producto en el dataset real — el id debe incluir esas variables
 * para no colisionar (y para que reingestas del mismo CSV sean idempotentes
 * vía upsert por `id`, sin duplicar filas).
 */
function buildDeterministicId(nroCertificado: string, concentracion: string, presentacionUnidades: string): string {
  const slug = `${nroCertificado}-${concentracion}-${presentacionUnidades}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `anmat-${slug}`;
}

function titleCase(text: string): string {
  return text
    .toLowerCase()
    .replace(/(^|\s)\S/g, (char) => char.toUpperCase());
}

/** Compone el string legible que ocupa el campo genérico `presentation` de Medication. */
export function composePresentationDisplay(
  formaFarmaceutica: string,
  concentracion: string,
  presentacionUnidades: string,
): string {
  const parts = [formaFarmaceutica, concentracion].filter(Boolean).map(titleCase);
  const headline = parts.join(' ');
  return presentacionUnidades ? `${headline} — ${titleCase(presentacionUnidades)}` : headline;
}
