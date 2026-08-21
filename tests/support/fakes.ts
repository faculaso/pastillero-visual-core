import { Ok, Err, type Result, DomainErrors, type DomainError, type Dose, type Treatment } from '../../src/domain';
import type { Clock, IdGenerator, TransactionRunner, NotificationScheduler } from '../../src/application';
import { InMemoryStore } from './in-memory-repos';

/**
 * Simula la semántica real de `TransactionRunner`: si `work` retorna `Err`
 * (o lanza), el store vuelve al snapshot previo — permite testear
 * atomicidad de `ConfirmDoseUseCase`/`RegisterTreatmentUseCase` sin
 * levantar SQLite (eso se cubre aparte en integración).
 */
export class InMemoryTransactionRunner implements TransactionRunner {
  constructor(private readonly store: InMemoryStore) {}

  async runInTransaction<T>(
    work: () => Promise<Result<T, DomainError>>,
  ): Promise<Result<T, DomainError>> {
    const snapshot = this.store.snapshot();
    try {
      const result = await work();
      if (!result.ok) this.store.restore(snapshot);
      return result;
    } catch (cause) {
      this.store.restore(snapshot);
      return Err(DomainErrors.repositoryFailure(cause));
    }
  }
}

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
  shouldFailDispatch = false;

  async scheduleDoseAlarm(dose: Dose): Promise<Result<void, DomainError>> {
    if (this.shouldFailScheduleFor.has(dose.id)) {
      return Err(DomainErrors.repositoryFailure(new Error('scheduler down')));
    }
    this.scheduledAlarms.push(dose.id);
    return Ok(undefined);
  }

  async cancelDoseAlarm(doseId: string): Promise<Result<void, DomainError>> {
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
