import { open } from '@op-engineering/op-sqlite';
import { OpSqliteAdapter } from './persistence/sqlite/adapters/op-sqlite.adapter';
import { MigrationRunner } from './persistence/sqlite/migration-runner';
import { MIGRATIONS } from './persistence/sqlite/migrations';
import { SqliteTransactionContext, SqliteTransactionRunner } from './persistence/sqlite/sqlite-transaction-context';
import { SqliteTreatmentRepository } from './persistence/sqlite/repositories/sqlite-treatment.repository';
import { SqliteDoseRepository } from './persistence/sqlite/repositories/sqlite-dose.repository';
import { SqliteStockRepository } from './persistence/sqlite/repositories/sqlite-stock.repository';
import { SqliteMedicationCatalogRepository } from './persistence/sqlite/repositories/sqlite-medication-catalog.repository';
import { SqliteMedicationVisualSuggestionProvider } from './persistence/sqlite/repositories/sqlite-medication-visual-suggestion.provider';
import { SystemClock } from './services/system-clock';
import { CryptoIdGenerator } from './services/crypto-id-generator';
import { NotifeeNotificationScheduler } from './services/notifee';
import { RNFSLocalImageStorageService } from './services/image-storage';
import { ReactNativeTtsService } from './services/tts';
import {
  ConfirmDoseUseCase,
  RegisterTreatmentUseCase,
  MonitorAdherenceUseCase,
  UpdateStockUseCase,
  GetPendingDosesForPatientUseCase,
  SearchMedicationCatalogUseCase,
  SuggestVisualProfileUseCase,
  GetDailyProgressUseCase,
} from '../application';
import type { NotificationScheduler, LocalImageStorageService, VoiceGuidancePort } from '../application';

export interface BootstrapResult {
  readonly confirmDose: ConfirmDoseUseCase;
  readonly registerTreatment: RegisterTreatmentUseCase;
  readonly monitorAdherence: MonitorAdherenceUseCase;
  readonly updateStock: UpdateStockUseCase;
  readonly getPendingDoses: GetPendingDosesForPatientUseCase;
  readonly searchMedicationCatalog: SearchMedicationCatalogUseCase;
  readonly suggestVisualProfile: SuggestVisualProfileUseCase;
  readonly localImageStorage: LocalImageStorageService;
  readonly voiceGuidance: VoiceGuidancePort;
  readonly getDailyProgress: GetDailyProgressUseCase;
}

export interface BootstrapOptions {
  /** Nombre del archivo SQLite (pasado directo a `open()` de op-sqlite). */
  readonly dbName?: string;
  /**
   * Override para tests, o para inyectar un `NotificationScheduler`
   * distinto — default: `NotifeeNotificationScheduler` (implementación
   * real). Si se pasa un override, ESTE código no llama
   * `registerForegroundHandler()` por vos: el caller ya sabe qué hacer
   * con lo que inyectó.
   */
  readonly notificationScheduler?: NotificationScheduler;
}

/**
 * Punto de entrada único que conoce TODAS las capas. Se llama UNA vez desde
 * el root de la app (antes de montar cualquier componente), nunca desde
 * dentro de una pantalla — eso violaría la regla de dependencia de Clean
 * Architecture (presentación solo debe conocer tipos de `application`).
 *
 * Orden de arranque:
 *  1. `open()` de op-sqlite — responsabilidad exclusiva de este archivo,
 *     tal como se acordó (infraestructura nunca llama `open()` por su cuenta).
 *  2. Migraciones, idempotentes en cada arranque.
 *  3. Wiring de repos + use cases sobre el mismo `SqliteTransactionContext`
 *     compartido (garantiza que `ConfirmDoseUseCase` sea atómico de verdad).
 *  4. `NotifeeNotificationScheduler` (si no hay override): se construye con
 *     `confirmDose` ya armado, y se registra su handler de FOREGROUND acá
 *     mismo. El de BACKGROUND (`notifee.onBackgroundEvent`) NO se toca en
 *     este archivo — debe registrarse en el `index.js` real de la app, ver
 *     `createBackgroundEventHandler` en `notifee-notification-scheduler.ts`.
 */
export async function bootstrap(options: BootstrapOptions = {}): Promise<BootstrapResult> {
  const opDb = open({ name: options.dbName ?? 'pastillero.db' });
  const sqliteDatabase = new OpSqliteAdapter(opDb);

  await new MigrationRunner(sqliteDatabase).applyAll(MIGRATIONS);

  const context = new SqliteTransactionContext(sqliteDatabase);
  const transactionRunner = new SqliteTransactionRunner(context);

  const treatmentRepository = new SqliteTreatmentRepository(context);
  const doseRepository = new SqliteDoseRepository(context);
  const stockRepository = new SqliteStockRepository(context);
  const medicationCatalogRepository = new SqliteMedicationCatalogRepository(context);

  const clock = new SystemClock();
  const idGenerator = new CryptoIdGenerator();

  const confirmDose = new ConfirmDoseUseCase(
    doseRepository,
    treatmentRepository,
    stockRepository,
    transactionRunner,
    clock,
  );

  const notificationScheduler = options.notificationScheduler ?? buildDefaultNotificationScheduler(confirmDose);

  return {
    confirmDose,
    registerTreatment: new RegisterTreatmentUseCase(
      medicationCatalogRepository,
      treatmentRepository,
      doseRepository,
      transactionRunner,
      notificationScheduler,
      idGenerator,
      clock,
    ),
    monitorAdherence: new MonitorAdherenceUseCase(
      treatmentRepository,
      doseRepository,
      stockRepository,
      notificationScheduler,
      clock,
    ),
    updateStock: new UpdateStockUseCase(treatmentRepository, stockRepository, notificationScheduler),
    getPendingDoses: new GetPendingDosesForPatientUseCase(doseRepository, treatmentRepository, clock),
    searchMedicationCatalog: new SearchMedicationCatalogUseCase(medicationCatalogRepository),
    suggestVisualProfile: new SuggestVisualProfileUseCase(
      new SqliteMedicationVisualSuggestionProvider(context),
    ),
    localImageStorage: new RNFSLocalImageStorageService(idGenerator),
    voiceGuidance: new ReactNativeTtsService(),
    getDailyProgress: new GetDailyProgressUseCase(doseRepository, clock),
  };
}

function buildDefaultNotificationScheduler(confirmDose: ConfirmDoseUseCase): NotificationScheduler {
  const scheduler = new NotifeeNotificationScheduler(confirmDose);
  scheduler.registerForegroundHandler();
  // No se espera (`await`) a propósito: pedir el permiso no debe bloquear
  // el arranque de la app — si el usuario tarda en responder el diálogo
  // del SO, la UI ya tiene que estar usable. Si lo rechaza, la app sigue
  // funcional (confirmación manual), solo sin alarmas push.
  void scheduler.requestPermissions();
  return scheduler;
}
