import {
  Ok,
  Err,
  type Result,
  DomainErrors,
  type DomainError,
  TreatmentStatus,
  confirmDose as domainConfirmDose,
  decrementStock,
  type DoseRepository,
  type TreatmentRepository,
  type StockRepository,
} from '../../domain';
import type { UseCase } from '../core/use-case';
import type { Clock } from '../ports/clock.port';
import type { TransactionRunner } from '../ports/transaction-runner.port';
import type { ConfirmDoseInput, ConfirmDoseOutput } from '../dto/confirm-dose.dto';

/**
 * CU-02 "Visualizar y Confirmar Toma de Medicación".
 *
 * Orquestación:
 *  1. Carga `Dose` y `Treatment` relacionado (fuera de la transacción: solo lectura).
 *  2. Autoriza: la toma debe pertenecer a un tratamiento del paciente solicitante.
 *  3. Valida invariantes de dominio (`confirmDose`, `decrementStock`) ANTES de
 *     tocar persistencia — fail-fast sin abrir transacción si algo es inválido.
 *  4. Persiste ambos cambios (dose + stock) dentro de `TransactionRunner`,
 *     garantizando atomicidad local (CU-02 postcondición: "toma registrada
 *     ... y stock decrementado" — ambos o ninguno).
 */
export class ConfirmDoseUseCase implements UseCase<ConfirmDoseInput, ConfirmDoseOutput> {
  constructor(
    private readonly doseRepository: DoseRepository,
    private readonly treatmentRepository: TreatmentRepository,
    private readonly stockRepository: StockRepository,
    private readonly transactionRunner: TransactionRunner,
    private readonly clock: Clock,
  ) {}

  async execute(input: ConfirmDoseInput): Promise<Result<ConfirmDoseOutput, DomainError>> {
    const doseResult = await this.doseRepository.findById(input.doseId);
    if (!doseResult.ok) return doseResult;
    const dose = doseResult.value;
    if (!dose) return Err(DomainErrors.doseNotFound(input.doseId));

    const treatmentResult = await this.treatmentRepository.findById(dose.treatmentId);
    if (!treatmentResult.ok) return treatmentResult;
    const treatment = treatmentResult.value;
    if (!treatment) return Err(DomainErrors.treatmentNotFound(dose.treatmentId));

    if (treatment.patientId !== input.requestingPatientId) {
      return Err(DomainErrors.unauthorizedActor(input.requestingPatientId, 'confirmDose'));
    }

    if (treatment.status !== TreatmentStatus.ACTIVE) {
      return Err(DomainErrors.treatmentNotActive(treatment.id, treatment.status));
    }

    const now = this.clock.now();
    const quantityTaken = input.quantityTaken ?? treatment.dosageScheme.dosagePerTake;

    // --- Validación pura de dominio, sin efectos secundarios todavía ---
    const confirmedDoseResult = domainConfirmDose(dose, now, quantityTaken);
    if (!confirmedDoseResult.ok) return confirmedDoseResult;

    const decrementedStockResult = decrementStock(treatment.stock, quantityTaken.amount);
    if (!decrementedStockResult.ok) return decrementedStockResult;

    // --- Persistencia atómica: ambas escrituras o ninguna ---
    return this.transactionRunner.runInTransaction(async () => {
      const persistedDoseResult = await this.doseRepository.confirmDose(
        dose.id,
        now,
        quantityTaken,
      );
      if (!persistedDoseResult.ok) return persistedDoseResult;

      const persistedStockResult = await this.stockRepository.decrement(
        treatment.id,
        quantityTaken.amount,
      );
      if (!persistedStockResult.ok) return persistedStockResult;

      return Ok({
        dose: persistedDoseResult.value,
        stock: persistedStockResult.value,
      });
    });
  }
}
