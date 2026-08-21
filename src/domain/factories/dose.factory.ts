import { Ok, Err, type Result } from '../core/result';
import { DomainErrors, type DomainError } from '../errors/domain.errors';
import { DoseStatus } from '../enums/dose.enums';
import type { Dose } from '../entities/dose.entity';
import type { Dosage } from '../value-objects/dosage.vo';

export interface CreateDoseSlotInput {
  readonly id: string; // generado en infraestructura
  readonly treatmentId: string;
  readonly scheduledAt: Date;
}

/** Invariante: todo slot nace en PENDING; `treatmentId`/`id` no vacíos. */
export function createDoseSlot(input: CreateDoseSlotInput): Result<Dose, DomainError> {
  if (!input.id.trim()) return Err(DomainErrors.validation('id de toma vacío'));
  if (!input.treatmentId.trim()) return Err(DomainErrors.validation('treatmentId vacío'));

  return Ok({
    id: input.id,
    treatmentId: input.treatmentId,
    scheduledAt: input.scheduledAt,
    status: DoseStatus.PENDING,
  });
}

/**
 * Confirmación de toma (CU-02 paso 4-5). Única operación permitida desde
 * PENDING; cualquier otro estado de origen es un error de dominio explícito
 * (idempotencia negativa: no se permite reconfirmar silenciosamente).
 */
export function confirmDose(
  dose: Dose,
  confirmedAt: Date,
  quantityTaken?: Dosage,
): Result<Dose, DomainError> {
  if (dose.status !== DoseStatus.PENDING) {
    return Err(DomainErrors.doseAlreadyConfirmed(dose.id));
  }
  return Ok({
    ...dose,
    status: DoseStatus.TAKEN,
    confirmedAt,
    quantityTaken: quantityTaken ?? dose.quantityTaken,
  });
}

/** Marca una toma vencida sin confirmar como MISSED. Solo válido desde PENDING. */
export function markDoseMissed(dose: Dose): Result<Dose, DomainError> {
  if (dose.status !== DoseStatus.PENDING) {
    return Err(DomainErrors.invalidStatusTransition(dose.status, DoseStatus.MISSED));
  }
  return Ok({ ...dose, status: DoseStatus.MISSED });
}

/** El cuidador omite deliberadamente una toma (p. ej. indicación médica puntual). Solo desde PENDING. */
export function skipDose(dose: Dose): Result<Dose, DomainError> {
  if (dose.status !== DoseStatus.PENDING) {
    return Err(DomainErrors.invalidStatusTransition(dose.status, DoseStatus.SKIPPED));
  }
  return Ok({ ...dose, status: DoseStatus.SKIPPED });
}
