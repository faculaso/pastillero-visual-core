import type { VisualProfileSuggestion } from '../ports/medication-visual-suggestion.port';

export interface SuggestVisualProfileInput {
  readonly medicationId: string;
}

export interface SuggestVisualProfileOutput {
  /** `null` cuando no hay suficiente información ANMAT para sugerir nada (medicamento cargado manualmente, sin match en el catálogo oficial). */
  readonly suggestion: VisualProfileSuggestion | null;
}
