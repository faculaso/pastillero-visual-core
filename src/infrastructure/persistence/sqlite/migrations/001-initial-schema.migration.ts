/**
 * Misma migración que `001_initial_schema.sql` (fuente legible para
 * humanos/tooling de DB, usada por los tests de integración vía
 * `fs.readFileSync`), pero como módulo TS: React Native no tiene acceso a
 * `fs` en runtime, así que el SQL que corre en el dispositivo tiene que
 * venir empaquetado como string, no leído de un archivo.
 *
 * LÍMITE CONOCIDO: mantener este archivo y el `.sql` sincronizados a mano.
 * Si el esquema crece, vale la pena un script de build que genere uno a
 * partir del otro (o un test que compare ambos contenidos byte a byte).
 */
export const MIGRATION_001_INITIAL_SCHEMA_SQL = `
PRAGMA foreign_keys = ON;

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

CREATE TABLE IF NOT EXISTS treatments (
  id                          TEXT PRIMARY KEY,
  patient_id                  TEXT NOT NULL,
  caregiver_id                TEXT NOT NULL,
  medication_id               TEXT NOT NULL REFERENCES medications (id),

  status                      TEXT NOT NULL
                                 CHECK (status IN ('ACTIVE','PAUSED','COMPLETED','CANCELLED')),

  visual_shape                TEXT NOT NULL
                                 CHECK (visual_shape IN ('ROUND','OVAL','CAPSULE','RECTANGULAR','TRIANGULAR','OTHER')),
  visual_color                TEXT NOT NULL,
  visual_pill_image_url       TEXT,
  visual_box_image_url        TEXT,
  visual_model3d_url          TEXT,
  visual_slot_label           TEXT,

  dosage_frequency            TEXT NOT NULL
                                 CHECK (dosage_frequency IN ('DAILY','SPECIFIC_WEEKDAYS','CUSTOM_INTERVAL_DAYS','AS_NEEDED')),
  dosage_times_of_day_json    TEXT NOT NULL DEFAULT '[]',
  dosage_amount               REAL NOT NULL CHECK (dosage_amount > 0),
  dosage_unit                 TEXT NOT NULL
                                 CHECK (dosage_unit IN ('MG','MCG','G','ML','UI','UNIT')),
  dosage_start_date           TEXT NOT NULL,
  dosage_end_date             TEXT,
  dosage_interval_days        INTEGER,
  dosage_weekdays_json        TEXT,

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

CREATE TABLE IF NOT EXISTS doses (
  id                        TEXT PRIMARY KEY,
  treatment_id              TEXT NOT NULL REFERENCES treatments (id) ON DELETE CASCADE,
  scheduled_at               TEXT NOT NULL,
  status                     TEXT NOT NULL DEFAULT 'PENDING'
                                CHECK (status IN ('PENDING','TAKEN','MISSED','SKIPPED')),
  confirmed_at               TEXT,
  quantity_taken_amount      REAL,
  quantity_taken_unit        TEXT
                                CHECK (quantity_taken_unit IS NULL
                                       OR quantity_taken_unit IN ('MG','MCG','G','ML','UI','UNIT'))
);

CREATE INDEX IF NOT EXISTS idx_doses_treatment_scheduled
  ON doses (treatment_id, scheduled_at);

CREATE INDEX IF NOT EXISTS idx_doses_status_scheduled
  ON doses (status, scheduled_at);

CREATE INDEX IF NOT EXISTS idx_doses_treatment_status
  ON doses (treatment_id, status);
`;
