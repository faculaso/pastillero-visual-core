/**
 * Espejo runtime de `002_anmat_catalog_fields.sql` — ver ese archivo para
 * el detalle de las decisiones de modelado. Mismo límite conocido que
 * `001-initial-schema.migration.ts`: mantener ambos sincronizados a mano.
 */
export const MIGRATION_002_ANMAT_CATALOG_FIELDS_SQL = `
ALTER TABLE medications ADD COLUMN nro_certificado TEXT;
ALTER TABLE medications ADD COLUMN forma_farmaceutica TEXT;
ALTER TABLE medications ADD COLUMN concentracion TEXT;
ALTER TABLE medications ADD COLUMN presentacion_unidades TEXT;

CREATE INDEX IF NOT EXISTS idx_medications_nro_certificado ON medications (nro_certificado);

DROP INDEX IF EXISTS idx_medications_name;
CREATE INDEX IF NOT EXISTS idx_medications_name ON medications (name COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_medications_active_ingredient ON medications (active_ingredient COLLATE NOCASE);

CREATE VIRTUAL TABLE IF NOT EXISTS medications_fts USING fts5(
  name,
  active_ingredient,
  content='medications',
  content_rowid='rowid'
);

INSERT INTO medications_fts(rowid, name, active_ingredient)
  SELECT rowid, name, active_ingredient FROM medications;

CREATE TRIGGER IF NOT EXISTS medications_fts_ai AFTER INSERT ON medications BEGIN
  INSERT INTO medications_fts(rowid, name, active_ingredient)
  VALUES (new.rowid, new.name, new.active_ingredient);
END;

CREATE TRIGGER IF NOT EXISTS medications_fts_ad AFTER DELETE ON medications BEGIN
  INSERT INTO medications_fts(medications_fts, rowid, name, active_ingredient)
  VALUES ('delete', old.rowid, old.name, old.active_ingredient);
END;

CREATE TRIGGER IF NOT EXISTS medications_fts_au AFTER UPDATE ON medications BEGIN
  INSERT INTO medications_fts(medications_fts, rowid, name, active_ingredient)
  VALUES ('delete', old.rowid, old.name, old.active_ingredient);
  INSERT INTO medications_fts(rowid, name, active_ingredient)
  VALUES (new.rowid, new.name, new.active_ingredient);
END;
`;
