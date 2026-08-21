import type { Result } from '../../domain';
import type { DomainError } from '../../domain';
import type { PillShape, MeasurementUnit } from '../../domain';

export interface VisualProfileSuggestion {
  readonly shape: PillShape;
  readonly slotLabel?: string;
  readonly suggestedStock?: {
    readonly quantity: number;
    readonly unit: MeasurementUnit;
  };
}

/**
 * Puerto de aplicación, NO de dominio: `MedicationCatalogRepository` (en
 * `domain/repositories`) expone `Medication` sin campos ANMAT — es el
 * contrato estable que usan `RegisterTreatmentUseCase` y el resto del
 * sistema. Este puerto es una capacidad ADICIONAL y opcional (autocompletar
 * el formulario de CU-01), por eso vive en `application/ports` junto a
 * `Clock`/`NotificationScheduler` — técnica, no de persistencia central.
 */
export interface MedicationVisualSuggestionProvider {
  getSuggestion(medicationId: string): Promise<Result<VisualProfileSuggestion | null, DomainError>>;
}
