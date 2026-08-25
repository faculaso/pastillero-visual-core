/** Estado de una toma individual (slot). CU-02: PENDING -> TAKEN vía confirmación del usuario. */
export enum DoseStatus {
  PENDING = 'PENDING',
  TAKEN = 'TAKEN',
  MISSED = 'MISSED',
  SKIPPED = 'SKIPPED', // omitida deliberadamente por el cuidador
}

/** Prioridad de la notificación disparada por ACT-03 (CU-02 paso 1). */
export enum NotificationPriority {
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
}

/** Forma física del comprimido para el reconocimiento visual (RF-02). */
export enum PillShape {
  ROUND = 'ROUND',
  OVAL = 'OVAL',
  CAPSULE = 'CAPSULE',
  CAPSULE_BICOLOR = 'CAPSULE_BICOLOR',
  RECTANGULAR = 'RECTANGULAR',
  TRIANGULAR = 'TRIANGULAR',
  OTHER = 'OTHER',
}
