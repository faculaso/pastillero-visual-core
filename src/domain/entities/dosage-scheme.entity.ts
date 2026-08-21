import { DosageFrequency } from '../enums/treatment.enums';
import type { Dosage } from '../value-objects/dosage.vo';
import type { TimeOfDay } from '../value-objects/time-of-day.vo';

/**
 * DosageScheme: posología configurada en CU-01 paso 8 (RF-01). Es la
 * "plantilla" recurrente a partir de la cual el caso de uso de scheduling
 * genera instancias concretas de `Dose`.
 */
export interface DosageScheme {
  readonly frequency: DosageFrequency;
  readonly timesOfDay: readonly TimeOfDay[]; // vacío si frequency = AS_NEEDED
  readonly dosagePerTake: Dosage;
  readonly startDate: Date;
  readonly endDate?: Date; // undefined = tratamiento continuo
  readonly intervalDays?: number; // solo aplica a CUSTOM_INTERVAL_DAYS
  readonly weekdays?: readonly number[]; // 0(dom)-6(sáb), solo SPECIFIC_WEEKDAYS
}
