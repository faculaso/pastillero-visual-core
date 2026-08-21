// Core
export * from './core/result';
export * from './errors/domain.errors';

// Enums
export * from './enums/treatment.enums';
export * from './enums/dose.enums';
export * from './enums/stock.enums';

// Value Objects
export * from './value-objects/dosage.vo';
export * from './value-objects/time-of-day.vo';

// Entities
export * from './entities/medication.entity';
export * from './entities/visual-profile.entity';
export * from './entities/dosage-scheme.entity';
export * from './entities/stock-info.entity';
export * from './entities/treatment.entity';
export * from './entities/dose.entity';
export * from './entities/adherence-metrics.entity';

// Repository Contracts
export * from './repositories/medication-catalog.repository';
export * from './repositories/treatment.repository';
export * from './repositories/dose.repository';
export * from './repositories/stock-adherence.repository';

// Factories / Invariantes de dominio
export * from './factories/dosage.factory';
export * from './factories/dosage-scheme.factory';
export * from './factories/visual-profile.factory';
export * from './factories/stock.factory';
export * from './factories/treatment.factory';
export * from './factories/dose.factory';
export * from './factories/dose-scheduling.factory';
export * from './factories/adherence.factory';
