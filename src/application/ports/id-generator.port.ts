/** Abstrae la generación de identificadores únicos (uuid v4 u otro esquema en infra). */
export interface IdGenerator {
  generate(): string;
}
