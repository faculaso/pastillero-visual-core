import type { Result } from '../../domain';
import type { DomainError } from '../../domain';
import type { Dose } from '../../domain';
import type { Treatment } from '../../domain';
import type { StockAlertLevel } from '../../domain';

/** Una alarma de toma ya programada en este dispositivo. */
export interface ScheduledDoseAlarm {
  readonly doseId: string;
  /** Cuándo va a sonar. */
  readonly scheduledAt: Date;
}

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
  /**
   * Las alarmas de toma que HOY viven en este dispositivo, con la hora a la
   * que van a sonar.
   *
   * Existe para que `SyncDoseAlarmsUseCase` pueda comparar contra lo que
   * debería estar programado y tocar solo la diferencia. Sin esto, re-armar
   * significaría reprogramar todas las tomas del horizonte en cada apertura.
   *
   * La hora no es un adorno: sin ella, una alarma que no aparece entre las
   * tomas del paciente es ambigua — puede ser de una toma más allá del
   * horizonte consultado (hay que dejarla) o basura de otro paciente (hay
   * que apagarla). Con la hora, esa distinción es exacta.
   */
  scheduledDoseAlarms(): Promise<Result<readonly ScheduledDoseAlarm[], DomainError>>;
  /**
   * ¿La alarma de toma suena hoy aunque el teléfono esté en No Molestar?
   *
   * No alcanza con pedirlo al crear el canal: Android lo ignora en silencio
   * si la app no tiene concedido el acceso a No Molestar. Esto lee lo que el
   * dispositivo realmente hace, no lo que se pidió.
   */
  doseAlarmBypassesDnd(): Promise<Result<boolean, DomainError>>;
  /** Abre la pantalla del sistema donde se concede el acceso a No Molestar. Solo la persona puede darlo. */
  openDndAccessSettings(): Promise<Result<void, DomainError>>;
  /**
   * Vuelve a crear el canal de alarma para que tome un acceso a No Molestar
   * recién concedido, y devuelve si quedó sonando en No Molestar. Se llama al
   * volver de los ajustes del sistema: el canal ya existente nació sin el
   * permiso y esos ajustes no se pueden editar, solo rehacer.
   */
  refreshDoseAlarmChannel(): Promise<Result<boolean, DomainError>>;
  /** CU-03 paso 4: alerta de reposición temprana cuando el stock alcanza nivel CRITICAL. */
  dispatchStockAlert(
    treatment: Treatment,
    alertLevel: StockAlertLevel,
    daysRemaining: number,
  ): Promise<Result<void, DomainError>>;
  /** Best-effort: limpia una alerta previa cuando el stock vuelve a nivel seguro tras CU-03 paso 5. */
  clearStockAlert(treatmentId: string): Promise<Result<void, DomainError>>;
}
