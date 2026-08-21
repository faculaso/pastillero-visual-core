import { Ok, Err, type Result } from '../core/result';
import { DomainErrors, type DomainError } from '../errors/domain.errors';
import type { Dosage } from '../value-objects/dosage.vo';
import { MeasurementUnit } from '../enums/treatment.enums';
import type { TimeOfDay } from '../value-objects/time-of-day.vo';

/** Invariante: la cantidad debe ser estrictamente positiva y finita. */
export function createDosage(amount: number, unit: MeasurementUnit): Result<Dosage, DomainError> {
  if (!Number.isFinite(amount) || amount <= 0) {
    return Err(DomainErrors.invalidQuantity(amount));
  }
  return Ok({ amount, unit });
}

/** Invariante: hora 0-23, minuto 0-59, ambos enteros. */
export function createTimeOfDay(hour: number, minute: number): Result<TimeOfDay, DomainError> {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    return Err(DomainErrors.validation(`Hora fuera de rango (0-23): ${hour}`));
  }
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) {
    return Err(DomainErrors.validation(`Minuto fuera de rango (0-59): ${minute}`));
  }
  return Ok({ hour, minute });
}
