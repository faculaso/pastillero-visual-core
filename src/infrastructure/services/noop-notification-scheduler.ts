import { Ok, type Result } from '../../domain';
import type { DomainError } from '../../domain';
import type { NotificationScheduler, ScheduledDoseAlarm } from '../../application';

/**
 * STUB — no programa alarmas reales. Útil para tests o para builds que
 * deliberadamente no quieren notificaciones (p. ej. un modo demo). Desde
 * que existe `NotifeeNotificationScheduler`, `bootstrap()` YA NO usa este
 * stub por default — hay que pasarlo explícito vía `BootstrapOptions.notificationScheduler`
 * si se lo necesita.
 */
export class NoopNotificationScheduler implements NotificationScheduler {
  async scheduleDoseAlarm(): Promise<Result<void, DomainError>> {
    return Ok(undefined);
  }
  async cancelDoseAlarm(): Promise<Result<void, DomainError>> {
    return Ok(undefined);
  }
  async scheduledDoseAlarms(): Promise<Result<readonly ScheduledDoseAlarm[], DomainError>> {
    return Ok([]);
  }
  async doseAlarmBypassesDnd(): Promise<Result<boolean, DomainError>> {
    return Ok(false);
  }
  async openDndAccessSettings(): Promise<Result<void, DomainError>> {
    return Ok(undefined);
  }
  async refreshDoseAlarmChannel(): Promise<Result<boolean, DomainError>> {
    return Ok(false);
  }
  async dispatchStockAlert(): Promise<Result<void, DomainError>> {
    return Ok(undefined);
  }
  async clearStockAlert(): Promise<Result<void, DomainError>> {
    return Ok(undefined);
  }
}
