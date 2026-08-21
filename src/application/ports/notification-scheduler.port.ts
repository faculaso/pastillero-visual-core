import type { Result } from '../../domain';
import type { DomainError } from '../../domain';
import type { Dose } from '../../domain';
import type { Treatment } from '../../domain';
import type { StockAlertLevel } from '../../domain';

/**
 * Puerto hacia ACT-03 (Servicio de Notificaciones/OS del DCU). Se ejecuta
 * best-effort DESPUÉS de confirmar la persistencia principal: una falla al
 * programar una alarma no debe revertir la creación del tratamiento ni de
 * la toma — se reporta como warning al caller (ver DTOs de los use cases).
 *
 * `scheduleDoseAlarm`/`dispatchStockAlert` reciben el `Treatment` completo
 * (no solo `visualProfile`/`treatmentId` sueltos): una notificación real
 * necesita el nombre del medicamento y la dosis para ser útil ("Es hora de
 * tomar Paracetamol — 1 comprimido"), no solo un id interno.
 */
export interface NotificationScheduler {
  scheduleDoseAlarm(dose: Dose, treatment: Treatment): Promise<Result<void, DomainError>>;
  cancelDoseAlarm(doseId: string): Promise<Result<void, DomainError>>;
  /** CU-03 paso 4: alerta de reposición temprana cuando el stock alcanza nivel CRITICAL. */
  dispatchStockAlert(
    treatment: Treatment,
    alertLevel: StockAlertLevel,
    daysRemaining: number,
  ): Promise<Result<void, DomainError>>;
  /** Best-effort: limpia una alerta previa cuando el stock vuelve a nivel seguro tras CU-03 paso 5. */
  clearStockAlert(treatmentId: string): Promise<Result<void, DomainError>>;
}
