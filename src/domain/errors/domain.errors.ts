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
  | 'INVITE_CODE_ALREADY_USED'
  | 'INVITE_CODE_LIMIT_REACHED'
  | 'TOO_MANY_CAREGIVERS'
  | 'AUTH_INVALID_CREDENTIALS'
  | 'AUTH_EMAIL_ALREADY_IN_USE'
  | 'RECOVERY_CODE_INVALID';

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

  /** Cada código sirve una sola vez: ya hay un cuidador atado a este. */
  inviteCodeAlreadyUsed: () =>
    new DomainError('INVITE_CODE_ALREADY_USED', 'Ese código ya fue usado por otro cuidador'),

  /** Del lado del Adulto Mayor: pedir un cuarto código cuando ya hay 3 lugares ocupados o entregados. */
  inviteCodeLimitReached: (max: number) =>
    new DomainError('INVITE_CODE_LIMIT_REACHED', `No se pueden tener más de ${max} cuidadores`),

  /** Del lado del Cuidador: el tope ya está lleno del otro lado. */
  tooManyCaregivers: (max: number) =>
    new DomainError('TOO_MANY_CAREGIVERS', `Esa persona ya tiene ${max} cuidadores`),

  authInvalidCredentials: () =>
    new DomainError('AUTH_INVALID_CREDENTIALS', 'Correo o contraseña incorrectos'),

  authEmailAlreadyInUse: (email: string) =>
    new DomainError('AUTH_EMAIL_ALREADY_IN_USE', `Ya existe una cuenta con el correo ${email}`),

  /**
   * El código de 6 dígitos del mail de recuperación no sirve. Supabase no
   * distingue "mal tipeado" de "vencido" y está bien que no lo haga: la
   * salida es la misma, pedir uno nuevo.
   */
  recoveryCodeInvalid: () =>
    new DomainError('RECOVERY_CODE_INVALID', 'El código no es válido o ya venció'),
} as const;
