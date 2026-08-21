import { describe, it, expect } from 'vitest';
import { parseAnmatCsvRow, composePresentationDisplay } from '../../../../src/infrastructure/persistence/sqlite/anmat/anmat-record.mapper';

const validRow = {
  nro_certificado: '55.123',
  nombre_comercial: 'Actron',
  generico_droga: 'Ibuprofeno',
  forma_farmaceutica: 'COMPRIMIDOS RECUBIERTOS',
  concentracion: '400 MG',
  presentacion_unidades: 'ENVASE X 10 COMPRIMIDOS',
  laboratorio: 'Bayer',
};

describe('parseAnmatCsvRow', () => {
  it('mapea una fila completa correctamente', () => {
    const result = parseAnmatCsvRow(validRow);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.nombreComercial).toBe('Actron');
    expect(result.value.genericoDroga).toBe('Ibuprofeno');
    expect(result.value.laboratorio).toBe('Bayer');
    expect(result.value.id).toMatch(/^anmat-/);
  });

  it.each(['nro_certificado', 'nombre_comercial', 'generico_droga', 'laboratorio'])(
    'rechaza fila sin %s',
    (field) => {
      const row = { ...validRow, [field]: '' };
      const result = parseAnmatCsvRow(row);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('VALIDATION_ERROR');
    },
  );

  it('acepta forma_farmaceutica/concentracion/presentacion_unidades ausentes (no son obligatorios)', () => {
    const { forma_farmaceutica, concentracion, presentacion_unidades, ...minimal } = validRow;
    const result = parseAnmatCsvRow(minimal);
    expect(result.ok).toBe(true);
  });

  it('el id es determinístico: misma fila -> mismo id (idempotencia de reingesta)', () => {
    const a = parseAnmatCsvRow(validRow);
    const b = parseAnmatCsvRow(validRow);
    expect(a.ok && b.ok && a.value.id === b.value.id).toBe(true);
  });

  it('certificados iguales con distinta concentración generan ids distintos', () => {
    const a = parseAnmatCsvRow(validRow);
    const b = parseAnmatCsvRow({ ...validRow, concentracion: '600 MG' });
    expect(a.ok && b.ok && a.value.id !== b.value.id).toBe(true);
  });
});

describe('composePresentationDisplay', () => {
  it('compone forma + concentración + presentación en un string legible', () => {
    const result = composePresentationDisplay('COMPRIMIDOS RECUBIERTOS', '400 MG', 'ENVASE X 10 COMPRIMIDOS');
    expect(result).toBe('Comprimidos Recubiertos 400 Mg — Envase X 10 Comprimidos');
  });

  it('omite partes vacías sin dejar separadores sueltos', () => {
    const result = composePresentationDisplay('COMPRIMIDOS', '', '');
    expect(result).toBe('Comprimidos');
  });
});
