import { create, type StoreApi, type UseBoundStore } from 'zustand';
import type {
  GetPendingDosesForPatientUseCase,
  ConfirmDoseUseCase,
  PendingDoseView,
} from '../../application';
import type { DomainError } from '../../domain';
import type { ConfirmationFeedback } from '../services/confirmation-feedback.service';

export type PastilleroVirtualStatus = 'idle' | 'loading' | 'ready' | 'confirming' | 'error';

export interface PastilleroVirtualState {
  readonly status: PastilleroVirtualStatus;
  readonly doses: readonly PendingDoseView[];
  readonly error: string | null;
  loadPendingDoses(patientId: string): Promise<void>;
  confirmCurrentDose(patientId: string): Promise<void>;
  dismissError(): void;
}

export interface PastilleroVirtualDeps {
  readonly getPendingDoses: GetPendingDosesForPatientUseCase;
  readonly confirmDose: ConfirmDoseUseCase;
  readonly confirmationFeedback: ConfirmationFeedback;
}

/**
 * Factory en vez de store módulo-nivel: recibe los use cases por parámetro
 * (DI explícita) para poder instanciar un store real por test sin mockear
 * imports globales, y para que el wiring de infraestructura quede
 * confinado al `UseCasesProvider` (composition root de presentación).
 *
 * Solo expone "la toma actual" (`doses[0]`, ya viene ordenada por el use
 * case) — CU-02 renderiza una toma a la vez, no una lista completa.
 */
export function createPastilleroVirtualStore(
  deps: PastilleroVirtualDeps,
): UseBoundStore<StoreApi<PastilleroVirtualState>> {
  return create<PastilleroVirtualState>((set, get) => ({
    status: 'idle',
    doses: [],
    error: null,

    async loadPendingDoses(patientId: string) {
      set({ status: 'loading', error: null });
      const result = await deps.getPendingDoses.execute({ patientId });
      if (!result.ok) {
        set({ status: 'error', error: describeError(result.error) });
        return;
      }
      set({ status: 'ready', doses: result.value.doses });
    },

    async confirmCurrentDose(patientId: string) {
      const current = get().doses[0];
      if (!current) return; // no hay nada que confirmar — el botón no debería estar habilitado en este caso

      set({ status: 'confirming', error: null });
      const result = await deps.confirmDose.execute({
        doseId: current.doseId,
        requestingPatientId: patientId,
      });

      if (!result.ok) {
        set({ status: 'error', error: describeError(result.error) });
        return;
      }

      deps.confirmationFeedback.playSuccess();
      set((state) => ({
        status: 'ready',
        doses: state.doses.filter((d) => d.doseId !== current.doseId),
      }));
    },

    dismissError() {
      set({ status: get().doses.length > 0 ? 'ready' : 'idle', error: null });
    },
  }));
}

/**
 * Mensajes orientados al Cuidador (que suele ser quien resuelve el problema
 * si algo falla), no al Adulto Mayor — la pantalla se los muestra a él,
 * pero la redacción asume que va a pedir ayuda a su cuidador ante un error.
 */
function describeError(error: DomainError): string {
  switch (error.code) {
    case 'DOSE_ALREADY_CONFIRMED':
      return 'Esta toma ya fue registrada. Pedile a tu cuidador que revise el pastillero.';
    case 'STOCK_INSUFFICIENT':
      return 'No hay stock suficiente registrado. Avisale a tu cuidador para reponer la medicación.';
    case 'TREATMENT_NOT_ACTIVE':
      return 'Este tratamiento no está activo. Consultá con tu cuidador.';
    case 'UNAUTHORIZED_ACTOR':
      return 'No pudimos verificar tu identidad. Volvé a abrir la aplicación.';
    default:
      return 'Ocurrió un problema al guardar la toma. Intentá de nuevo en unos segundos.';
  }
}
