import type { Result } from '../core/result';
import type { DomainError } from '../errors/domain.errors';
import type { Dose } from '../entities/dose.entity';
import type { StockInfo } from '../entities/stock-info.entity';
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
  /** Todas las tomas del día (cualquier status) — usado para el progreso diario, no solo las pendientes. */
  findAllByPatientAndDate(
    patientId: string,
    date: Date,
  ): Promise<Result<readonly Dose[], DomainError>>;
  findByTreatmentInRange(
    treatmentId: string,
    from: Date,
    to: Date,
  ): Promise<Result<readonly Dose[], DomainError>>;
  /** Todas las tomas (cualquier status) de un paciente en un rango arbitrario — usado por el pastillero semanal (Cuidador y Adulto Mayor). */
  findByPatientInRange(
    patientId: string,
    from: Date,
    to: Date,
  ): Promise<Result<readonly Dose[], DomainError>>;
  /** Persiste el resultado ya validado por el dominio (`confirmDose` factory). */
  confirmDose(
    doseId: string,
    confirmedAt: Date,
    quantityTaken?: Dosage,
  ): Promise<Result<Dose, DomainError>>;
  /**
   * Confirma la toma Y decrementa el stock del tratamiento en una sola
   * operación atómica (todo o nada) — reemplaza la orquestación previa vía
   * `TransactionRunner` (`ConfirmDoseUseCase` llamando `confirmDose` +
   * `StockRepository.decrement` por separado), que no es portable a un
   * backend sin transacciones cross-request (ver implementación Supabase,
   * que usa una función RPC para esto).
   */
  confirmDoseWithStockDecrement(
    doseId: string,
    confirmedAt: Date,
    quantityTaken: Dosage,
  ): Promise<
    Result<
      {
        readonly dose: Dose;
        readonly stock: StockInfo;
        /**
         * El stock registrado no cubría la toma: quedó en cero. La toma se
         * registra igual — el stock es una estimación que carga el Cuidador
         * a mano, la toma es un hecho.
         */
        readonly stockWasShort: boolean;
      },
      DomainError
    >
  >;
  markMissed(doseId: string): Promise<Result<Dose, DomainError>>;
}
