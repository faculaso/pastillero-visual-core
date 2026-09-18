/**
 * Códigos de error de dominio. Cerrado intencionalmente (no `string` genérico)
 * para que el compilador obligue a manejar cada caso en los `switch` de la
 * capa de aplicación (exhaustividad vía `never`).
 */
export type DomainErrorCode =
  | 'MEDICATION_NOT_FOUND'
  | 'MEDICATION_DUPLICATE_BARCODE'
  | 'TREATMENT_NOT_FOUND'
  | 'TREATMENT_NOT_ACTIVE'
  | 'TREATMENT_INVALID_STATUS_TRANSITION'
  | 'DOSE_NOT_FOUND'
  | 'DOSE_ALREADY_CONFIRMED'
  | 'DOSE_OUT_OF_WINDOW'
  | 'STOCK_INSUFFICIENT'
  | 'STOCK_INVALID_QUANTITY'
  | 'DOSAGE_SCHEME_INVALID'
  | 'VALIDATION_ERROR'
  | 'REPOSITORY_FAILURE'
  | 'UNAUTHORIZED_ACTOR'
  | 'INVITE_CODE_INVALID'
  | 'CANNOT_LINK_TO_SELF'
  | 'AUTH_INVALID_CREDENTIALS'
  | 'AUTH_EMAIL_ALREADY_IN_USE';

export class DomainError extends Error {
  public readonly code: DomainErrorCode;
  public readonly cause?: unknown;

  constructor(code: DomainErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.cause = cause;
  }
}

/** Helpers de construcción para no repetir `new DomainError(...)` en toda la app. */
export const DomainErrors = {
  medicationNotFound: (id: string) =>
    new DomainError('MEDICATION_NOT_FOUND', `Medicamento no encontrado: ${id}`),

  duplicateBarcode: (barcode: string) =>
    new DomainError('MEDICATION_DUPLICATE_BARCODE', `Código de barras duplicado: ${barcode}`),

  treatmentNotFound: (id: string) =>
    new DomainError('TREATMENT_NOT_FOUND', `Tratamiento no encontrado: ${id}`),

  treatmentNotActive: (id: string, currentStatus: string) =>
    new DomainError(
      'TREATMENT_NOT_ACTIVE',
      `Tratamiento ${id} no está activo (estado actual: ${currentStatus})`,
    ),

  invalidStatusTransition: (from: string, to: string) =>
    new DomainError(
      'TREATMENT_INVALID_STATUS_TRANSITION',
      `Transición de estado inválida: ${from} -> ${to}`,
    ),

  doseNotFound: (id: string) =>
    new DomainError('DOSE_NOT_FOUND', `Toma no encontrada: ${id}`),

  doseAlreadyConfirmed: (id: string) =>
    new DomainError('DOSE_ALREADY_CONFIRMED', `La toma ${id} ya fue confirmada`),

  insufficientStock: (treatmentId: string) =>
    new DomainError('STOCK_INSUFFICIENT', `Stock insuficiente para tratamiento ${treatmentId}`),

  invalidQuantity: (value: number) =>
    new DomainError('STOCK_INVALID_QUANTITY', `Cantidad de stock inválida: ${value}`),

  invalidDosageScheme: (reason: string) =>
    new DomainError('DOSAGE_SCHEME_INVALID', `Esquema de posología inválido: ${reason}`),

  validation: (reason: string) => new DomainError('VALIDATION_ERROR', reason),

  repositoryFailure: (cause: unknown) =>
    new DomainError('REPOSITORY_FAILURE', 'Fallo de infraestructura/persistencia', cause),

  unauthorizedActor: (actorId: string, action: string) =>
    new DomainError('UNAUTHORIZED_ACTOR', `Actor ${actorId} no autorizado para: ${action}`),

  inviteCodeInvalid: (code: string) =>
    new DomainError('INVITE_CODE_INVALID', `Código de invitación inválido: ${code}`),

  /** Con los dos roles en una misma cuenta, el código propio queda a la vista de quien también puede redimir. */
  cannotLinkToSelf: () =>
    new DomainError('CANNOT_LINK_TO_SELF', 'No podés vincularte a tu propia cuenta'),

  authInvalidCredentials: () =>
    new DomainError('AUTH_INVALID_CREDENTIALS', 'Correo o contraseña incorrectos'),

  authEmailAlreadyInUse: (email: string) =>
    new DomainError('AUTH_EMAIL_ALREADY_IN_USE', `Ya existe una cuenta con el correo ${email}`),
} as const;
