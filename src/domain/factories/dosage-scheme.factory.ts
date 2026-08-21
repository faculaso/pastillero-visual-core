import { Ok, Err, type Result } from '../core/result';
import { DomainErrors, type DomainError } from '../errors/domain.errors';
import { DosageFrequency } from '../enums/treatment.enums';
import type { DosageScheme } from '../entities/dosage-scheme.entity';

export interface CreateDosageSchemeInput {
  readonly frequency: DosageFrequency;
  readonly timesOfDay: readonly DosageScheme['timesOfDay'][number][];
  readonly dosagePerTake: DosageScheme['dosagePerTake'];
  readonly startDate: Date;
  readonly endDate?: Date;
  readonly intervalDays?: number;
  readonly weekdays?: readonly number[];
}

/**
 * Invariantes del esquema posológico (CU-01 paso 8, RF-01):
 * - `startDate` < `endDate` si ambas están presentes.
 * - `timesOfDay` no vacío salvo `AS_NEEDED`.
 * - `CUSTOM_INTERVAL_DAYS` requiere `intervalDays` >= 1.
 * - `SPECIFIC_WEEKDAYS` requiere `weekdays` no vacío, valores 0-6 sin duplicados.
 */
export function createDosageScheme(
  input: CreateDosageSchemeInput,
): Result<DosageScheme, DomainError> {
  const { frequency, timesOfDay, dosagePerTake, startDate, endDate, intervalDays, weekdays } =
    input;

  if (endDate !== undefined && endDate.getTime() <= startDate.getTime()) {
    return Err(DomainErrors.invalidDosageScheme('endDate debe ser posterior a startDate'));
  }

  if (frequency !== DosageFrequency.AS_NEEDED && timesOfDay.length === 0) {
    return Err(
      DomainErrors.invalidDosageScheme('timesOfDay no puede estar vacío salvo frecuencia AS_NEEDED'),
    );
  }

  if (frequency === DosageFrequency.CUSTOM_INTERVAL_DAYS) {
    if (intervalDays === undefined || !Number.isInteger(intervalDays) || intervalDays < 1) {
      return Err(
        DomainErrors.invalidDosageScheme('intervalDays debe ser un entero >= 1 para CUSTOM_INTERVAL_DAYS'),
      );
    }
  }

  if (frequency === DosageFrequency.SPECIFIC_WEEKDAYS) {
    const hasWeekdays = weekdays !== undefined && weekdays.length > 0;
    const validRange = weekdays?.every((d) => Number.isInteger(d) && d >= 0 && d <= 6) ?? false;
    const noDuplicates = weekdays !== undefined && new Set(weekdays).size === weekdays.length;
    if (!hasWeekdays || !validRange || !noDuplicates) {
      return Err(
        DomainErrors.invalidDosageScheme(
          'weekdays debe tener valores únicos entre 0-6 para SPECIFIC_WEEKDAYS',
        ),
      );
    }
  }

  return Ok({
    frequency,
    timesOfDay,
    dosagePerTake,
    startDate,
    endDate,
    intervalDays,
    weekdays,
  });
}
