import type {
  Treatment,
  Dose,
  MeasurementUnit,
  DosageFrequency,
  PillShape,
} from '../../domain';

export interface RegisterTreatmentInput {
  readonly caregiverId: string;
  readonly patientId: string;
  readonly medicationId: string; // resuelto contra MedicationCatalogRepository

  readonly visualProfile: {
    readonly shape: PillShape;
    readonly color: string;
    readonly pillImageUrl?: string;
    readonly boxImageUrl?: string;
    readonly model3dUrl?: string;
    readonly slotLabel?: string;
  };

  readonly dosageScheme: {
    readonly frequency: DosageFrequency;
    readonly timesOfDay: readonly { hour: number; minute: number }[];
    readonly dosagePerTake: { amount: number; unit: MeasurementUnit };
    readonly startDate: Date;
    readonly endDate?: Date;
    readonly intervalDays?: number;
    readonly weekdays?: readonly number[];
  };

  readonly initialStock: {
    readonly currentQuantity: number;
    readonly dailyConsumption: number;
    readonly unit: MeasurementUnit;
    readonly criticalThresholdDays?: number;
  };

  /** Horizonte de generación de slots iniciales. Default 30 días (ver use case). */
  readonly schedulingHorizonDays?: number;
}

export interface RegisterTreatmentOutput {
  readonly treatment: Treatment;
  readonly generatedDoses: readonly Dose[];
  /** Ids de dosis cuya alarma no pudo programarse (best-effort, no aborta el registro). */
  readonly notificationWarnings: readonly string[];
}
