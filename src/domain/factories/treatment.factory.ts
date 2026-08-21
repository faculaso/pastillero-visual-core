import { Ok, Err, type Result } from '../core/result';
import { DomainErrors, type DomainError } from '../errors/domain.errors';
import { TreatmentStatus } from '../enums/treatment.enums';
import type { Medication } from '../entities/medication.entity';
import type { VisualProfile } from '../entities/visual-profile.entity';
import type { DosageScheme } from '../entities/dosage-scheme.entity';
import type { StockInfo } from '../entities/stock-info.entity';
import { Treatment, VALID_TREATMENT_TRANSITIONS } from '../entities/treatment.entity';

export interface CreateTreatmentInput {
  readonly id: string; // generado en infraestructura (uuid), el dominio no genera ids
  readonly patientId: string;
  readonly caregiverId: string;
  readonly medication: Medication;
  readonly visualProfile: VisualProfile; // ya validado vía createVisualProfile
  readonly dosageScheme: DosageScheme; // ya validado vía createDosageScheme
  readonly stock: StockInfo; // ya validado vía createStockInfo
  readonly now: Date; // inyectado, no `new Date()` interno
}

/**
 * Invariantes de creación de Treatment (CU-01 completo):
 * - ids de actor (`patientId`, `caregiverId`) y `id` propio no vacíos.
 * - Sub-objetos (`visualProfile`, `dosageScheme`, `stock`) se asumen
 *   pre-validados por sus propias factories — este factory NO revalida su
 *   contenido interno, solo la coherencia a nivel agregado.
 * - Estado inicial siempre `ACTIVE` (CU-01 postcondición: "alarmas programadas").
 */
export function createTreatment(input: CreateTreatmentInput): Result<Treatment, DomainError> {
  const { id, patientId, caregiverId, medication, visualProfile, dosageScheme, stock, now } =
    input;

  if (!id.trim()) return Err(DomainErrors.validation('id de tratamiento vacío'));
  if (!patientId.trim()) return Err(DomainErrors.validation('patientId vacío'));
  if (!caregiverId.trim()) return Err(DomainErrors.validation('caregiverId vacío'));

  return Ok({
    id,
    patientId,
    caregiverId,
    medication,
    visualProfile,
    dosageScheme,
    stock,
    status: TreatmentStatus.ACTIVE,
    createdAt: now,
    updatedAt: now,
  });
}

/**
 * Transición de estado validada contra `VALID_TREATMENT_TRANSITIONS`
 * (definida junto a la entidad para que la matriz viva cerca del tipo).
 * Devuelve un nuevo `Treatment` inmutable con `updatedAt` refrescado.
 */
export function transitionTreatmentStatus(
  treatment: Treatment,
  newStatus: TreatmentStatus,
  now: Date,
): Result<Treatment, DomainError> {
  const allowed = VALID_TREATMENT_TRANSITIONS[treatment.status];
  if (!allowed.includes(newStatus)) {
    return Err(DomainErrors.invalidStatusTransition(treatment.status, newStatus));
  }
  return Ok({ ...treatment, status: newStatus, updatedAt: now });
}

/**
 * Reemplazo del stock embebido tras una operación válida de
 * `decrementStock`/`updateStockQuantity` (esas funciones ya garantizan las
 * invariantes de cantidad; acá solo se reconstituye el agregado).
 */
export function withUpdatedStock(treatment: Treatment, stock: StockInfo, now: Date): Treatment {
  return { ...treatment, stock, updatedAt: now };
}
