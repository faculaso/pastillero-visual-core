/** Ciclo de vida del tratamiento. CU-01 crea en ACTIVE; CU-03 puede pausarlo/cancelarlo. */
export enum TreatmentStatus {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

/** Frecuencia del esquema posológico (RF-01 / CU-01 paso 8). */
export enum DosageFrequency {
  DAILY = 'DAILY',
  SPECIFIC_WEEKDAYS = 'SPECIFIC_WEEKDAYS',
  CUSTOM_INTERVAL_DAYS = 'CUSTOM_INTERVAL_DAYS',
  AS_NEEDED = 'AS_NEEDED',
}

/** Unidades de medida soportadas para dosis y stock. */
export enum MeasurementUnit {
  MG = 'MG',
  MCG = 'MCG',
  G = 'G',
  ML = 'ML',
  UI = 'UI',
  UNIT = 'UNIT', // comprimidos/cápsulas sueltas
}
