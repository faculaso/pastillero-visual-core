import React, { createContext, useContext } from 'react';
import type {
  ConfirmDoseUseCase,
  RegisterTreatmentUseCase,
  MonitorAdherenceUseCase,
  UpdateStockUseCase,
  ChangeTreatmentStatusUseCase,
  GetPausedTreatmentsUseCase,
  GetPendingDosesForPatientUseCase,
  SearchMedicationCatalogUseCase,
  SuggestVisualProfileUseCase,
  LocalImageStorageService,
  VoiceGuidancePort,
  GetDailyProgressUseCase,
  RedeemInviteCodeUseCase,
  GetLinkedPatientUseCase,
  GetProfileUseCase,
  GetWeeklyScheduleUseCase,
  ExtendDoseHorizonUseCase,
  AuthPort,
} from '../../application';

/**
 * Bundle de use cases (y algunos servicios técnicos inyectados, como
 * `localImageStorage`) que la app necesita en presentación. Presentación
 * importa SOLO tipos de `application` acá — nunca de `infrastructure`. El
 * wiring real (SQLite, op-sqlite, notificaciones OS) ocurre en el punto de
 * entrada de la app (`App.tsx` o equivalente), que sí puede conocer todas
 * las capas, y le pasa el resultado a este Provider como props.
 */
export interface UseCasesBundle {
  readonly confirmDose: ConfirmDoseUseCase;
  readonly registerTreatment: RegisterTreatmentUseCase;
  readonly monitorAdherence: MonitorAdherenceUseCase;
  readonly updateStock: UpdateStockUseCase;
  readonly changeTreatmentStatus: ChangeTreatmentStatusUseCase;
  readonly getPausedTreatments: GetPausedTreatmentsUseCase;
  readonly getPendingDoses: GetPendingDosesForPatientUseCase;
  readonly searchMedicationCatalog: SearchMedicationCatalogUseCase;
  readonly suggestVisualProfile: SuggestVisualProfileUseCase;
  readonly localImageStorage: LocalImageStorageService;
  readonly voiceGuidance: VoiceGuidancePort;
  readonly getDailyProgress: GetDailyProgressUseCase;
  readonly redeemInviteCode: RedeemInviteCodeUseCase;
  readonly getLinkedPatient: GetLinkedPatientUseCase;
  readonly getProfile: GetProfileUseCase;
  readonly getWeeklySchedule: GetWeeklyScheduleUseCase;
  readonly extendDoseHorizon: ExtendDoseHorizonUseCase;
  readonly auth: AuthPort;
}

const UseCasesContext = createContext<UseCasesBundle | null>(null);

export interface UseCasesProviderProps {
  readonly useCases: UseCasesBundle;
  readonly children: React.ReactNode;
}

export function UseCasesProvider({ useCases, children }: UseCasesProviderProps): React.JSX.Element {
  return <UseCasesContext.Provider value={useCases}>{children}</UseCasesContext.Provider>;
}

export function useUseCases(): UseCasesBundle {
  const context = useContext(UseCasesContext);
  if (!context) {
    throw new Error('useUseCases() debe usarse dentro de <UseCasesProvider>');
  }
  return context;
}
