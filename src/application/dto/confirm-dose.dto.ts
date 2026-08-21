import type { Dose, StockInfo, Dosage } from '../../domain';

export interface ConfirmDoseInput {
  readonly doseId: string;
  /** ACT-01: se valida que la toma pertenezca al tratamiento de este paciente. */
  readonly requestingPatientId: string;
  /** Override opcional si la cantidad tomada difiere de `dosagePerTake` del scheme. */
  readonly quantityTaken?: Dosage;
}

export interface ConfirmDoseOutput {
  readonly dose: Dose;
  readonly stock: StockInfo;
}
