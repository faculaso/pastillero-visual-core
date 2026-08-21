import { DoseStatus } from '../enums/dose.enums';
import type { Dosage } from '../value-objects/dosage.vo';

/**
 * Dose: instancia concreta de una toma programada ("slot") derivada del
 * `DosageScheme` de un `Treatment` (CU-02). Es el objeto que el Adulto Mayor
 * confirma desde el pastillero virtual. Se persiste offline-first: el status
 * PENDING -> TAKEN debe poder ocurrir sin conectividad y sincronizar después.
 */
export interface Dose {
  readonly id: string;
  readonly treatmentId: string;
  readonly scheduledAt: Date;
  readonly status: DoseStatus;
  readonly confirmedAt?: Date;
  readonly quantityTaken?: Dosage; // normalmente = dosagePerTake del scheme, salvo ajuste manual
}
