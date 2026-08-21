import { TreatmentStatus } from '../enums/treatment.enums';
import type { Medication } from './medication.entity';
import type { VisualProfile } from './visual-profile.entity';
import type { DosageScheme } from './dosage-scheme.entity';
import type { StockInfo } from './stock-info.entity';

/**
 * Treatment: AGGREGATE ROOT del dominio (CU-01, CU-03).
 * Encapsula medicamento + perfil visual + posología + stock + estado.
 * Toda mutación (pausar, cancelar, ajustar stock) debe pasar por casos de
 * uso de aplicación que orquesten este agregado + `TreatmentRepository`,
 * nunca editando sub-objetos directamente desde la UI.
 */
export interface Treatment {
  readonly id: string;
  readonly patientId: string; // ACT-01
  readonly caregiverId: string; // ACT-02, dueño de la edición
  readonly medication: Medication;
  readonly visualProfile: VisualProfile;
  readonly dosageScheme: DosageScheme;
  readonly stock: StockInfo;
  readonly status: TreatmentStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** Transiciones de estado válidas — usado por la capa de aplicación para validar antes de persistir. */
export const VALID_TREATMENT_TRANSITIONS: Readonly<Record<TreatmentStatus, readonly TreatmentStatus[]>> = {
  [TreatmentStatus.ACTIVE]: [TreatmentStatus.PAUSED, TreatmentStatus.COMPLETED, TreatmentStatus.CANCELLED],
  [TreatmentStatus.PAUSED]: [TreatmentStatus.ACTIVE, TreatmentStatus.CANCELLED],
  [TreatmentStatus.COMPLETED]: [],
  [TreatmentStatus.CANCELLED]: [],
};
