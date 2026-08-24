-- =============================================================================
-- Migración 002: Enriquecimiento del catálogo con campos oficiales de ANMAT
-- =============================================================================
-- Decisiones de modelado:
-- 1. NO se duplica lo que ya significa lo mismo: `nombre_comercial` ANMAT ==
--    `name` (ya existente), `generico_droga` == `active_ingredient`,
--    `laboratorio` == `laboratory`. Se agregan solo los 4 campos genuinamente
--    NUEVOS: nro_certificado, forma_farmaceutica, concentracion,
--    presentacion_unidades. Guardar el mismo dato bajo dos nombres de columna
--    es una fuente de drift (¿cuál se actualiza si difieren?) sin beneficio.
-- 2. `forma_farmaceutica` es la pieza que habilita el mapeo automático a
--    PillShape (configurador visual) — es la razón principal de este campo.
-- 3. Búsqueda: FTS5 external-content sobre (name, active_ingredient), con
--    triggers AI/AD/AU para mantenerlo sincronizado ante cualquier INSERT/
--    UPDATE/DELETE futuro (no solo la ingesta ANMAT). Se complementa con
--    índices NOCASE por si el build de SQLite no trae FTS5 compilado — el
--    repositorio detecta la ausencia en runtime y cae a LIKE (ver
--    SqliteMedicationCatalogRepository).
-- =============================================================================

ALTER TABLE medications ADD COLUMN nro_certificado TEXT;
ALTER TABLE medications ADD COLUMN forma_farmaceutica TEXT;
ALTER TABLE medications ADD COLUMN concentracion TEXT;
ALTER TABLE medications ADD COLUMN presentacion_unidades TEXT;

CREATE INDEX IF NOT EXISTS idx_medications_nro_certificado ON medications (nro_certificado);

-- Reemplaza el índice simple de la migración 001 por uno case-insensitive:
-- fallback LIKE ya no depende de que el usuario tipee las mayúsculas exactas.
DROP INDEX IF EXISTS idx_medications_name;
CREATE INDEX IF NOT EXISTS idx_medications_name ON medications (name COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_medications_active_ingredient ON medications (active_ingredient COLLATE NOCASE);

-- -----------------------------------------------------------------------------
-- FTS5 external-content: no duplica el texto, solo indexa punteros (rowid)
-- hacia `medications`. `medications` es una tabla rowid normal (no declarada
-- WITHOUT ROWID), así que `rowid` existe implícitamente y sirve como
-- content_rowid sin necesidad de una columna INTEGER PK adicional.
--
-- Bloque OPTIONAL: builds de SQLite sin FTS5 compilado (algunos binarios de
-- op-sqlite en Android, verificado en dispositivo real) tiran "no such
-- module: fts5" acá. MigrationRunner ejecuta todo lo que está entre estos
-- marcadores en un paso aparte del resto de la migración y descarta el error
-- si falla, en vez de abortar (y hacer ROLLBACK de) la migración entera — las
-- columnas/índices de arriba son la parte que de verdad no puede fallar.
-- -----------------------------------------------------------------------------
-- OPTIONAL:BEGIN
CREATE VIRTUAL TABLE IF NOT EXISTS medications_fts USING fts5(
  name,
  active_ingredient,
  content='medications',
  content_rowid='rowid'
);

-- Backfill: esta migración corre una única vez (versionada en
-- schema_migrations), así que no hace falta guard de idempotencia acá.
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
-- OPTIONAL:END
