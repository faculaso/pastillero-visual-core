import { Ok, Err, type Result, DomainErrors, type DomainError, type Dose, type Treatment } from '../../src/domain';
import type { Clock, IdGenerator, NotificationScheduler, ScheduledDoseAlarm } from '../../src/application';

export class FakeClock implements Clock {
  constructor(private current: Date) {}
  now(): Date {
    return this.current;
  }
  set(date: Date): void {
    this.current = date;
  }
}

export class FakeIdGenerator implements IdGenerator {
  private counter = 0;
  generate(): string {
    this.counter += 1;
    return `fake-id-${this.counter}`;
  }
}

/** Registra cada llamada para poder assertar sobre ellas; `shouldFail` es configurable por test. */
export class FakeNotificationScheduler implements NotificationScheduler {
  readonly scheduledAlarms: string[] = [];
  readonly cancelledAlarms: string[] = [];
  readonly dispatchedAlerts: string[] = [];
  readonly clearedAlerts: string[] = [];
  shouldFailScheduleFor: ReadonlySet<string> = new Set();
  shouldFailCancelFor: ReadonlySet<string> = new Set();
  shouldFailDispatch = false;
  /** Lo que el dispositivo "ya tiene armado" — el sync compara contra esto. */
  alreadyScheduled: readonly ScheduledDoseAlarm[] = [];
  shouldFailListing = false;

  async scheduleDoseAlarm(dose: Dose): Promise<Result<void, DomainError>> {
    if (this.shouldFailScheduleFor.has(dose.id)) {
      return Err(DomainErrors.repositoryFailure(new Error('scheduler down')));
    }
    this.scheduledAlarms.push(dose.id);
    return Ok(undefined);
  }

  async scheduledDoseAlarms(): Promise<Result<readonly ScheduledDoseAlarm[], DomainError>> {
    if (this.shouldFailListing) {
      return Err(DomainErrors.repositoryFailure(new Error('scheduler down')));
    }
    return Ok(this.alreadyScheduled);
  }

  async cancelDoseAlarm(doseId: string): Promise<Result<void, DomainError>> {
    if (this.shouldFailCancelFor.has(doseId)) {
      return Err(DomainErrors.repositoryFailure(new Error('scheduler down')));
    }
    this.cancelledAlarms.push(doseId);
    return Ok(undefined);
  }

  async dispatchStockAlert(treatment: Treatment): Promise<Result<void, DomainError>> {
    if (this.shouldFailDispatch) {
      return Err(DomainErrors.repositoryFailure(new Error('dispatch down')));
    }
    this.dispatchedAlerts.push(treatment.id);
    return Ok(undefined);
  }

  async clearStockAlert(treatmentId: string): Promise<Result<void, DomainError>> {
    this.clearedAlerts.push(treatmentId);
    return Ok(undefined);
  }
}
