import type { Result } from '../core/result';
import type { DomainError } from '../errors/domain.errors';
import type { Dose } from '../entities/dose.entity';
import type { Dosage } from '../value-objects/dosage.vo';

/**
 * Puerto de persistencia de tomas/slots (CU-02). `confirmDose` es la
 * operación crítica offline-first: debe poder ejecutarse sin red y
 * sincronizar apenas haya conectividad (ver ACT-03 en el DCU).
 */
export interface DoseRepository {
  createSlots(doses: readonly Dose[]): Promise<Result<readonly Dose[], DomainError>>;
  findById(id: string): Promise<Result<Dose | null, DomainError>>;
  findPendingByPatientAndDate(
    patientId: string,
    date: Date,
  ): Promise<Result<readonly Dose[], DomainError>>;
  findByTreatmentInRange(
    treatmentId: string,
    from: Date,
    to: Date,
  ): Promise<Result<readonly Dose[], DomainError>>;
  /** Persiste el resultado ya validado por el dominio (`confirmDose` factory). */
  confirmDose(
    doseId: string,
    confirmedAt: Date,
    quantityTaken?: Dosage,
  ): Promise<Result<Dose, DomainError>>;
  markMissed(doseId: string): Promise<Result<Dose, DomainError>>;
}
