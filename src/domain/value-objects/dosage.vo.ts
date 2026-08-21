import { MeasurementUnit } from '../enums/treatment.enums';

/**
 * Value Object: cantidad + unidad. Sin identidad propia, comparable por valor.
 * La validación de invariantes (amount > 0) se hace en la capa de aplicación
 * al construirlo (factory), no acá — este archivo es solo el contrato de forma.
 */
export interface Dosage {
  readonly amount: number;
  readonly unit: MeasurementUnit;
}

export function dosageEquals(a: Dosage, b: Dosage): boolean {
  return a.amount === b.amount && a.unit === b.unit;
}
