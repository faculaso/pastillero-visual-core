import { create, type StoreApi, type UseBoundStore } from 'zustand';
import type {
  GetPendingDosesForPatientUseCase,
  ConfirmDoseUseCase,
  GetDailyProgressUseCase,
  PendingDoseView,
} from '../../application';
import type { DomainError } from '../../domain';
import type { ConfirmationFeedback } from '../services/confirmation-feedback.service';

export type PastilleroVirtualStatus = 'idle' | 'loading' | 'ready' | 'confirming' | 'error';

export interface DailyProgress {
  readonly totalScheduled: number;
  readonly totalTaken: number;
}

export interface PastilleroVirtualState {
  readonly status: PastilleroVirtualStatus;
  readonly doses: readonly PendingDoseView[];
  readonly error: string | null;
  /**
   * Aviso NO bloqueante: la toma se registró, pero el stock que lleva el
   * Cuidador no la cubría. Va aparte de `error` a propósito — un error tapa
   * el botón de confirmar, y acá no hay nada que reintentar: ya está hecho.
   */
  readonly stockNotice: string | null;
  readonly dailyProgress: DailyProgress | null;
  /** Se incrementa en cada confirmación exitosa — la UI lo usa para disparar la animación de celebración sin necesitar resetear un booleano. */
  readonly celebrationTrigger: number;
  loadPendingDoses(patientId: string): Promise<void>;
  /** `doseId` explícito (no siempre `doses[0]`): dos tomas programadas a la misma hora se navegan
   *  deslizando en la pantalla, y cualquiera de las dos puede confirmarse primero. */
  confirmCurrentDose(patientId: string, doseId: string): Promise<void>;
  dismissError(): void;
  dismissStockNotice(): void;
}

export interface PastilleroVirtualDeps {
  readonly getPendingDoses: GetPendingDosesForPatientUseCase;
  readonly confirmDose: ConfirmDoseUseCase;
  readonly getDailyProgress: GetDailyProgressUseCase;
  readonly confirmationFeedback: ConfirmationFeedback;
}

/**
 * Factory en vez de store módulo-nivel: recibe los use cases por parámetro
 * (DI explícita) para poder instanciar un store real por test sin mockear
 * imports globales, y para que el wiring de infraestructura quede
 * confinado al `UseCasesProvider` (composition root de presentación).
 *
 * Expone `doses` ya ordenado por horario (por el use case) — la pantalla
 * decide qué mostrar: normalmente la primera toma pendiente (`doses[0]`),
 * pero si hay más de una programada exactamente a la misma hora, las
 * agrupa y navega entre ellas deslizando (ver `PastilleroVirtualScreen`).
 * `confirmCurrentDose` recibe el `doseId` puntual a confirmar en vez de
 * asumir siempre `doses[0]`, justamente para soportar ese caso.
 */
export function createPastilleroVirtualStore(
  deps: PastilleroVirtualDeps,
): UseBoundStore<StoreApi<PastilleroVirtualState>> {
  async function refreshDailyProgress(patientId: string, set: (partial: Partial<PastilleroVirtualState>) => void) {
    // Best-effort real: ni un Err del dominio NI un reject de la promesa
    // (p. ej. el use case ni siquiera está implementado en un contexto de
    // test) deben propagarse — es una pieza puramente decorativa, nunca
    // debe tumbar el flujo principal de confirmar/cargar tomas.
    try {
      const result = await deps.getDailyProgress.execute({ patientId });
      if (result.ok) set({ dailyProgress: result.value });
    } catch {
      // silenciado a propósito
    }
  }

  return create<PastilleroVirtualState>((set, get) => ({
    status: 'idle',
    doses: [],
    error: null,
    stockNotice: null,
    dailyProgress: null,
    celebrationTrigger: 0,

    async loadPendingDoses(patientId: string) {
      set({ status: 'loading', error: null, stockNotice: null });
      const result = await deps.getPendingDoses.execute({ patientId });
      if (!result.ok) {
        set({ status: 'error', error: describeError(result.error) });
        return;
      }
      set({ status: 'ready', doses: result.value.doses });
      void refreshDailyProgress(patientId, set);
    },

    async confirmCurrentDose(patientId: string, doseId: string) {
      const current = get().doses.find((d) => d.doseId === doseId);
      if (!current) return; // no hay nada que confirmar — el botón no debería estar habilitado en este caso

      set({ status: 'confirming', error: null, stockNotice: null });
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
        celebrationTrigger: state.celebrationTrigger + 1,
        // La celebración se dispara igual: la toma ocurrió. Esto solo suma
        // el dato de que el inventario del Cuidador quedó viejo.
        stockNotice: result.value.stockWasShort
          ? 'Quedó registrada. Avisale a tu cuidador que se terminó este remedio.'
          : null,
      }));
      void refreshDailyProgress(patientId, set);
    },

    dismissError() {
      set({ status: get().doses.length > 0 ? 'ready' : 'idle', error: null });
    },

    dismissStockNotice() {
      set({ stockNotice: null });
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
    // Solo llega desde una base donde todavía no se aplicó la migración
    // 0007: esa versión de `confirm_dose_atomic` no deja registrar la toma
    // si el stock no alcanza. Con 0007 aplicada, esto pasa a ser
    // `stockNotice` y la toma se registra igual.
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
