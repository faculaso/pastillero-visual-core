import { open, moveAssetsDatabase } from '@op-engineering/op-sqlite';
import { OpSqliteAdapter } from './persistence/sqlite/adapters/op-sqlite.adapter';
import {
  OfflineFallbackDoseRepository,
  OfflineFallbackTreatmentRepository,
  OfflineFallbackProfileRepository,
  OfflineFallbackPairingRepository,
} from './persistence/offline/offline-fallback.repositories';
import { AsyncStorageSnapshotCache } from './services/async-storage-snapshot-cache';
import { MigrationRunner } from './persistence/sqlite/migration-runner';
import { MIGRATIONS } from './persistence/sqlite/migrations';
import { importBundledCatalogIfStale } from './persistence/sqlite/import-bundled-catalog';
import { SqliteTransactionContext } from './persistence/sqlite/sqlite-transaction-context';
import { SqliteMedicationCatalogRepository } from './persistence/sqlite/repositories/sqlite-medication-catalog.repository';
import { SqliteMedicationVisualSuggestionProvider } from './persistence/sqlite/repositories/sqlite-medication-visual-suggestion.provider';
import { supabase } from './persistence/supabase/supabase-client';
import { SupabaseTreatmentRepository } from './persistence/supabase/repositories/supabase-treatment.repository';
import { SupabaseDoseRepository } from './persistence/supabase/repositories/supabase-dose.repository';
import { SupabaseStockRepository } from './persistence/supabase/repositories/supabase-stock.repository';
import { SupabaseProfileRepository } from './persistence/supabase/repositories/supabase-profile.repository';
import { SupabasePairingRepository } from './persistence/supabase/repositories/supabase-pairing.repository';
import { SupabaseAuthAdapter } from './services/supabase-auth.adapter';
import { HibpLeakedPasswordCheck } from './services/hibp-leaked-password-check';
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
  ChangeTreatmentStatusUseCase,
  GetPausedTreatmentsUseCase,
  GetPendingDosesForPatientUseCase,
  SearchMedicationCatalogUseCase,
  SuggestVisualProfileUseCase,
  GetDailyProgressUseCase,
  ExtendDoseHorizonUseCase,
  SyncDoseAlarmsUseCase,
  RedeemInviteCodeUseCase,
  GetLinkedPatientsUseCase,
  GetProfileUseCase,
  EnableRoleUseCase,
  GetPairingOverviewUseCase,
  CreateInviteCodeUseCase,
  RevokeInviteCodeUseCase,
  UnlinkCaregiverUseCase,
  GetWeeklyScheduleUseCase,
} from '../application';
import type {
  NotificationScheduler,
  LocalImageStorageService,
  VoiceGuidancePort,
  AuthPort,
  LeakedPasswordCheck,
} from '../application';

export interface BootstrapResult {
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
  readonly extendDoseHorizon: ExtendDoseHorizonUseCase;
  readonly syncDoseAlarms: SyncDoseAlarmsUseCase;
  readonly redeemInviteCode: RedeemInviteCodeUseCase;
  readonly getLinkedPatients: GetLinkedPatientsUseCase;
  readonly getProfile: GetProfileUseCase;
  readonly enableRole: EnableRoleUseCase;
  readonly getPairingOverview: GetPairingOverviewUseCase;
  readonly createInviteCode: CreateInviteCodeUseCase;
  readonly revokeInviteCode: RevokeInviteCodeUseCase;
  readonly unlinkCaregiver: UnlinkCaregiverUseCase;
  readonly getWeeklySchedule: GetWeeklyScheduleUseCase;
  readonly auth: AuthPort;
  readonly leakedPasswordCheck: LeakedPasswordCheck;
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
 * Nombre del asset embebido con el catálogo ANMAT completo pre-poblado —
 * ver `import-bundled-catalog.ts`. Nombre distinto al de la DB de la app
 * (`pastillero.db`) a propósito: son dos archivos SQLite separados, nunca
 * se pisan entre sí.
 *
 * UBICACIÓN (verificada contra el código fuente de
 * `moveAssetsDatabase` en op-sqlite — Android): el `path` por defecto de
 * `moveAssetsDatabase` es `"custom"`, así que el archivo tiene que vivir en
 * `android/app/src/main/assets/custom/pastillero-catalog.db`, NO
 * directamente en `android/app/src/main/assets/`. Si no está en esa
 * subcarpeta exacta, `moveAssetsDatabase` no tira excepción — resuelve
 * `false` silenciosamente (ver su try/catch en OPSQLiteModule.kt), lo cual
 * hace este bug fácil de pasar por alto sin loggear el resultado a mano.
 */
const CATALOG_ASSET_FILENAME = 'pastillero-catalog.db';

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
 *  3. Wiring MIXTO de repos: el catálogo ANMAT (solo lectura, compartido)
 *     sigue en SQLite local sobre `SqliteTransactionContext`; tratamientos,
 *     dosis y stock ahora viven en Supabase (`supabase-client.ts`, sesión
 *     ya autenticada vía Supabase Auth) para sincronizar entre el teléfono
 *     del Cuidador y el del Adulto Mayor. La atomicidad de
 *     "confirmar toma + descontar stock" y "crear tratamiento + sus dosis"
 *     ya NO depende de un `TransactionRunner` compartido — cada una es un
 *     solo método de repositorio (ver `DoseRepository.confirmDoseWithStockDecrement`
 *     / `TreatmentRepository.createWithInitialDoses`), transaccional del
 *     lado de SQLite o vía una función RPC del lado de Supabase.
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
  await importBundledCatalogIfPresent(sqliteDatabase);

  const context = new SqliteTransactionContext(sqliteDatabase);

  // El catálogo ANMAT (~16.000 medicamentos, dato de referencia compartido
  // y de solo lectura) se queda en SQLite local — NO migró a Supabase.
  // Tratamientos/dosis/stock sí, porque son datos por-cuenta que el
  // Cuidador y el Adulto Mayor necesitan ver sincronizados entre sus dos
  // teléfonos distintos. Bootstrap mixto a propósito, no un descuido.
  const medicationCatalogRepository = new SqliteMedicationCatalogRepository(context);

  // Respaldo local de LECTURA sobre los repos remotos. Los contratos del
  // dominio prometen poder funcionar sin red (ver los docblocks de
  // `DoseRepository` y `TreatmentRepository`) y hasta acá no se cumplía:
  // sin conexión la pantalla quedaba en blanco justo después de que sonara
  // la alarma. No es sincronización: Supabase manda, esto solo evita que
  // perder la red signifique perder el pastillero.
  const snapshotCache = new AsyncStorageSnapshotCache();
  const treatmentRepository = new OfflineFallbackTreatmentRepository(
    new SupabaseTreatmentRepository(supabase, medicationCatalogRepository),
    snapshotCache,
  );
  const doseRepository = new OfflineFallbackDoseRepository(new SupabaseDoseRepository(supabase), snapshotCache);
  const stockRepository = new SupabaseStockRepository(supabase, medicationCatalogRepository);
  // El perfil es el más crítico de todos: `SessionContext` lo pide para
  // saber el rol y, si no lo consigue, te devuelve a la pantalla de login.
  const profileRepository = new OfflineFallbackProfileRepository(
    new SupabaseProfileRepository(supabase),
    snapshotCache,
  );
  const pairingRepository = new OfflineFallbackPairingRepository(
    new SupabasePairingRepository(supabase),
    snapshotCache,
  );
  const authAdapter = new SupabaseAuthAdapter(supabase);

  const clock = new SystemClock();
  const idGenerator = new CryptoIdGenerator();

  const confirmDose = new ConfirmDoseUseCase(doseRepository, treatmentRepository, clock);

  const notificationScheduler = options.notificationScheduler ?? buildDefaultNotificationScheduler(confirmDose);

  return {
    confirmDose,
    registerTreatment: new RegisterTreatmentUseCase(
      medicationCatalogRepository,
      treatmentRepository,
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
    changeTreatmentStatus: new ChangeTreatmentStatusUseCase(
      treatmentRepository,
      doseRepository,
      notificationScheduler,
      clock,
    ),
    getPausedTreatments: new GetPausedTreatmentsUseCase(treatmentRepository),
    getPendingDoses: new GetPendingDosesForPatientUseCase(
      doseRepository,
      treatmentRepository,
      clock,
      profileRepository,
    ),
    searchMedicationCatalog: new SearchMedicationCatalogUseCase(medicationCatalogRepository),
    suggestVisualProfile: new SuggestVisualProfileUseCase(
      new SqliteMedicationVisualSuggestionProvider(context),
    ),
    localImageStorage: new RNFSLocalImageStorageService(idGenerator),
    voiceGuidance: new ReactNativeTtsService(),
    getDailyProgress: new GetDailyProgressUseCase(doseRepository, treatmentRepository, clock),
    extendDoseHorizon: new ExtendDoseHorizonUseCase(
      treatmentRepository,
      doseRepository,
      notificationScheduler,
      idGenerator,
      clock,
    ),
    syncDoseAlarms: new SyncDoseAlarmsUseCase(
      treatmentRepository,
      doseRepository,
      notificationScheduler,
      clock,
    ),
    redeemInviteCode: new RedeemInviteCodeUseCase(pairingRepository),
    getLinkedPatients: new GetLinkedPatientsUseCase(pairingRepository),
    getProfile: new GetProfileUseCase(profileRepository),
    enableRole: new EnableRoleUseCase(profileRepository),
    getPairingOverview: new GetPairingOverviewUseCase(pairingRepository),
    createInviteCode: new CreateInviteCodeUseCase(pairingRepository),
    revokeInviteCode: new RevokeInviteCodeUseCase(pairingRepository),
    unlinkCaregiver: new UnlinkCaregiverUseCase(pairingRepository),
    getWeeklySchedule: new GetWeeklyScheduleUseCase(doseRepository, treatmentRepository, clock),
    auth: authAdapter,
    leakedPasswordCheck: new HibpLeakedPasswordCheck(),
  };
}

/**
 * Best-effort: si el host no bundleó `CATALOG_ASSET_FILENAME` como asset
 * (por ejemplo, un checkout del Core sin pasar por `host-integration/` +
 * copiar el `.db`), `moveAssetsDatabase` rechaza — no debe tumbar el
 * arranque de la app por eso, el catálogo simplemente queda como estaba.
 * Igual para cualquier falla durante la importación en sí.
 */
async function importBundledCatalogIfPresent(sqliteDatabase: OpSqliteAdapter): Promise<void> {
  try {
    const moved = await moveAssetsDatabase({ filename: CATALOG_ASSET_FILENAME });
    if (!moved) return;

    const catalogDb = open({ name: CATALOG_ASSET_FILENAME });
    try {
      await importBundledCatalogIfStale(sqliteDatabase, new OpSqliteAdapter(catalogDb));
    } finally {
      catalogDb.close();
    }
  } catch {
    // Sin catálogo embebido o falló la importación: la app sigue con lo que ya tenía.
  }
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
