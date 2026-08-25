/**
 * Espejo runtime de `003_capsule_bicolor_shape.sql` — ver ese archivo para
 * el detalle de las decisiones de modelado (en particular, por qué la tabla
 * nueva se arma bajo `treatments_new` en vez de renombrar la original).
 * Mismo límite conocido que `001-initial-schema.migration.ts`: mantener
 * ambos sincronizados a mano.
 */
export const MIGRATION_003_CAPSULE_BICOLOR_SHAPE_SQL = `
CREATE TABLE treatments_new (
  id                          TEXT PRIMARY KEY,
  patient_id                  TEXT NOT NULL,
  caregiver_id                TEXT NOT NULL,
  medication_id               TEXT NOT NULL REFERENCES medications (id),

  status                      TEXT NOT NULL
                                 CHECK (status IN ('ACTIVE','PAUSED','COMPLETED','CANCELLED')),

  visual_shape                TEXT NOT NULL
                                 CHECK (visual_shape IN ('ROUND','OVAL','CAPSULE','CAPSULE_BICOLOR','RECTANGULAR','TRIANGULAR','OTHER')),
  visual_color                TEXT NOT NULL,
  visual_secondary_color      TEXT,
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

INSERT INTO treatments_new (
  id, patient_id, caregiver_id, medication_id, status,
  visual_shape, visual_color, visual_secondary_color, visual_pill_image_url, visual_box_image_url,
  visual_model3d_url, visual_slot_label,
  dosage_frequency, dosage_times_of_day_json, dosage_amount, dosage_unit,
  dosage_start_date, dosage_end_date, dosage_interval_days, dosage_weekdays_json,
  stock_current_quantity, stock_daily_consumption, stock_unit, stock_critical_threshold_days,
  created_at, updated_at
)
SELECT
  id, patient_id, caregiver_id, medication_id, status,
  visual_shape, visual_color, NULL, visual_pill_image_url, visual_box_image_url,
  visual_model3d_url, visual_slot_label,
  dosage_frequency, dosage_times_of_day_json, dosage_amount, dosage_unit,
  dosage_start_date, dosage_end_date, dosage_interval_days, dosage_weekdays_json,
  stock_current_quantity, stock_daily_consumption, stock_unit, stock_critical_threshold_days,
  created_at, updated_at
FROM treatments;

DROP TABLE treatments;

ALTER TABLE treatments_new RENAME TO treatments;

CREATE INDEX IF NOT EXISTS idx_treatments_patient ON treatments (patient_id, status);
CREATE INDEX IF NOT EXISTS idx_treatments_caregiver ON treatments (caregiver_id);
`;
