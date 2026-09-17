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
  /**
   * La toma se registró pero el stock registrado no la cubría: quedó en
   * cero. No es un error — es la señal de que el inventario que carga el
   * Cuidador está desactualizado, y la única forma de enterarse.
   */
  readonly stockWasShort: boolean;
}
