-- =============================================================================
-- Migración 001: Esquema inicial — Pastillero Visual (Core)
-- =============================================================================
-- Decisiones de modelado:
-- 1. `treatments` embebe visual_profile + dosage_scheme + stock como columnas
--    planas (VOs sin identidad propia ni repo dedicado — ver capa de dominio).
--    Arrays (timesOfDay, weekdays) se guardan como TEXT JSON: SQLite no tiene
--    tipo array nativo y no ameritan tabla aparte por su cardinalidad baja.
-- 2. Las columnas de stock viven en la MISMA tabla que consulta
--    StockRepository (no hay tabla "stocks" separada): es la única fuente de
--    verdad, evita el problema de sincronizar dos copias del mismo dato.
-- 3. CHECK constraints replican en la DB las invariantes ya validadas en el
--    dominio (defensa en profundidad ante escrituras que no pasen por la app,
--    migraciones futuras, o bugs de mapeo).
-- 4. PRAGMA foreign_keys debe activarse por conexión (no persiste en el
--    archivo .db) — se hace en el adapter de infraestructura al abrir la DB.
-- =============================================================================

PRAGMA foreign_keys = ON;

-- -----------------------------------------------------------------------------
-- medications: caché local de solo-lectura del catálogo Vademécum/ANMAT
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS medications (
  id                  TEXT PRIMARY KEY,
  name                TEXT NOT NULL,
  active_ingredient   TEXT NOT NULL,
  laboratory          TEXT NOT NULL,
  presentation        TEXT NOT NULL,
  barcode             TEXT,
  synced_at           TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_medications_barcode
  ON medications (barcode)
  WHERE barcode IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_medications_name ON medications (name);

-- -----------------------------------------------------------------------------
-- treatments: agregado raíz (Treatment) — CU-01, CU-03
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS treatments (
  id                          TEXT PRIMARY KEY,
  patient_id                  TEXT NOT NULL,
  caregiver_id                TEXT NOT NULL,
  medication_id               TEXT NOT NULL REFERENCES medications (id),

  status                      TEXT NOT NULL
                                 CHECK (status IN ('ACTIVE','PAUSED','COMPLETED','CANCELLED')),

  -- VisualProfile (RF-02)
  visual_shape                TEXT NOT NULL
                                 CHECK (visual_shape IN ('ROUND','OVAL','CAPSULE','RECTANGULAR','TRIANGULAR','OTHER')),
  visual_color                TEXT NOT NULL,
  visual_pill_image_url       TEXT,
  visual_box_image_url        TEXT,
  visual_model3d_url          TEXT,
  visual_slot_label           TEXT,

  -- DosageScheme (RF-01)
  dosage_frequency            TEXT NOT NULL
                                 CHECK (dosage_frequency IN ('DAILY','SPECIFIC_WEEKDAYS','CUSTOM_INTERVAL_DAYS','AS_NEEDED')),
  dosage_times_of_day_json    TEXT NOT NULL DEFAULT '[]',   -- '[{"hour":8,"minute":0}, ...]'
  dosage_amount               REAL NOT NULL CHECK (dosage_amount > 0),
  dosage_unit                 TEXT NOT NULL
                                 CHECK (dosage_unit IN ('MG','MCG','G','ML','UI','UNIT')),
  dosage_start_date           TEXT NOT NULL,                -- ISO 8601
  dosage_end_date             TEXT,
  dosage_interval_days        INTEGER,
  dosage_weekdays_json        TEXT,                         -- '[1,3,5]'

  -- StockInfo (RF-05) — única fuente de verdad de inventario
  stock_current_quantity      REAL NOT NULL CHECK (stock_current_quantity >= 0),
  stock_daily_consumption     REAL NOT NULL CHECK (stock_daily_consumption >= 0),
  stock_unit                  TEXT NOT NULL
                                 CHECK (stock_unit IN ('MG','MCG','G','ML','UI','UNIT')),
  stock_critical_threshold_days INTEGER NOT NULL DEFAULT 3 CHECK (stock_critical_threshold_days >= 1),

  created_at                  TEXT NOT NULL,
  updated_at                  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_treatments_patient ON treatments (patient_id, status);
CREATE INDEX IF NOT EXISTS idx_treatments_caregiver ON treatments (caregiver_id);

-- -----------------------------------------------------------------------------
-- doses: slots de toma (Dose) — CU-02, alto volumen de escritura
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS doses (
  id                        TEXT PRIMARY KEY,
  treatment_id              TEXT NOT NULL REFERENCES treatments (id) ON DELETE CASCADE,
  scheduled_at               TEXT NOT NULL,                 -- ISO 8601
  status                     TEXT NOT NULL DEFAULT 'PENDING'
                                CHECK (status IN ('PENDING','TAKEN','MISSED','SKIPPED')),
  confirmed_at               TEXT,
  quantity_taken_amount      REAL,
  quantity_taken_unit        TEXT
                                CHECK (quantity_taken_unit IS NULL
                                       OR quantity_taken_unit IN ('MG','MCG','G','ML','UI','UNIT'))
);

-- Cubre findByTreatmentInRange y el filtro por status usado en confirm/missed.
CREATE INDEX IF NOT EXISTS idx_doses_treatment_scheduled
  ON doses (treatment_id, scheduled_at);

CREATE INDEX IF NOT EXISTS idx_doses_status_scheduled
  ON doses (status, scheduled_at);

-- Soporta findPendingByPatientAndDate sin necesitar patient_id desnormalizado:
-- el JOIN usa este índice + idx_treatments_patient del lado de treatments.
CREATE INDEX IF NOT EXISTS idx_doses_treatment_status
  ON doses (treatment_id, status);
