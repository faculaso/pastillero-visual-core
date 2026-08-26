import notifee, {
  AndroidImportance,
  AndroidVisibility,
  AndroidCategory,
  AlarmType,
  TriggerType,
  EventType,
  type Event as NotifeeEvent,
  type Notification as NotifeeNotification,
} from '@notifee/react-native';
import { Ok, Err, type Result, DomainErrors, type DomainError } from '../../../domain';
import type { Dose, Treatment, StockAlertLevel } from '../../../domain';
import type { NotificationScheduler } from '../../../application';
import type { ConfirmDoseUseCase } from '../../../application';
import {
  NOTIFEE_CHANNELS,
  NOTIFEE_ACTIONS,
  doseNotificationId,
  stockNotificationId,
  doseIdFromNotificationId,
} from './notifee-constants';
import { formatDosageLabel } from './format-dosage-label';

const SNOOZE_MINUTES = 15;

/**
 * Implementación real de `NotificationScheduler` sobre `@notifee/react-native`.
 *
 * El puerto en sí (`scheduleDoseAlarm`, `cancelDoseAlarm`, `dispatchStockAlert`,
 * `clearStockAlert`) se implementa como clase normal, inyectada vía
 * `bootstrap.ts` como cualquier otro repo/servicio.
 *
 * Las ACCIONES INTERACTIVAS ("Confirmar Toma"/"Posponer 15 min") son otra
 * historia: `notifee.onBackgroundEvent` tiene que registrarse en el
 * `index.js` real de la app, ANTES de `AppRegistry.registerComponent` —
 * y un evento en background puede llegar con la app completamente matada,
 * en cuyo caso RN levanta un contexto headless nuevo sin ninguna instancia
 * previa viva. Por eso esa lógica NO es un método de instancia: son
 * funciones standalone (`handleNotifeeEvent`, `createBackgroundEventHandler`)
 * que reciben lo que necesitan por parámetro en cada invocación, sin
 * depender de que exista un `NotifeeNotificationScheduler` ya construido.
 * `registerForegroundHandler()` sí es de instancia porque el caso
 * foreground (app viva) ocurre después del bootstrap normal, donde una
 * instancia con `confirmDoseUseCase` ya inyectado tiene sentido.
 */
export class NotifeeNotificationScheduler implements NotificationScheduler {
  private channelsReadyPromise: Promise<void> | null = null;

  constructor(private readonly confirmDoseUseCase: ConfirmDoseUseCase) {}

  // ---------------------------------------------------------------------
  // Puerto NotificationScheduler
  // ---------------------------------------------------------------------

  async scheduleDoseAlarm(dose: Dose, treatment: Treatment): Promise<Result<void, DomainError>> {
    try {
      await this.ensureChannelsCreated();

      await notifee.createTriggerNotification(
        buildDoseNotification(dose, treatment),
        {
          type: TriggerType.TIMESTAMP,
          timestamp: dose.scheduledAt.getTime(),
          alarmManager: { type: AlarmType.SET_EXACT_AND_ALLOW_WHILE_IDLE }, // dispara exacto incluso en Doze
        },
      );

      return Ok(undefined);
    } catch (cause) {
      return Err(DomainErrors.repositoryFailure(cause));
    }
  }

  async cancelDoseAlarm(doseId: string): Promise<Result<void, DomainError>> {
    try {
      await notifee.cancelNotification(doseNotificationId(doseId));
      return Ok(undefined);
    } catch (cause) {
      return Err(DomainErrors.repositoryFailure(cause));
    }
  }

  async dispatchStockAlert(
    treatment: Treatment,
    alertLevel: StockAlertLevel,
    daysRemaining: number,
  ): Promise<Result<void, DomainError>> {
    try {
      await this.ensureChannelsCreated();

      await notifee.displayNotification({
        id: stockNotificationId(treatment.id),
        title: `Reponer stock: ${treatment.medication.name}`,
        body: Number.isFinite(daysRemaining)
          ? `Quedan aproximadamente ${Math.max(0, Math.floor(daysRemaining))} día(s) de stock (${alertLevel}).`
          : 'Revisá el stock disponible.',
        android: {
          channelId: NOTIFEE_CHANNELS.stockAlerts,
          importance: AndroidImportance.HIGH,
          smallIcon: 'ic_notification',
          pressAction: { id: 'default' },
        },
      });

      return Ok(undefined);
    } catch (cause) {
      return Err(DomainErrors.repositoryFailure(cause));
    }
  }

  async clearStockAlert(treatmentId: string): Promise<Result<void, DomainError>> {
    try {
      await notifee.cancelNotification(stockNotificationId(treatmentId));
      return Ok(undefined);
    } catch (cause) {
      return Err(DomainErrors.repositoryFailure(cause));
    }
  }

  // ---------------------------------------------------------------------
  // Acciones interactivas — caso FOREGROUND (la app está viva, ya tenemos
  // una instancia con `confirmDoseUseCase` inyectado por el bootstrap normal).
  // ---------------------------------------------------------------------

  /**
   * Registra el handler de foreground. El de BACKGROUND (`notifee.onBackgroundEvent`)
   * NO se registra acá — ver `createBackgroundEventHandler` más abajo y el
   * docblock de la clase: background debe registrarse en `index.js`, antes
   * de que exista cualquier instancia de esta clase.
   */
  registerForegroundHandler(): void {
    notifee.onForegroundEvent(this.handleEvent);
  }

  /**
   * Android 13+ (API 33): sin esto, NINGUNA notificación se muestra —
   * ni siquiera las del canal `dose-reminders` en importancia HIGH. En
   * iOS dispara el diálogo estándar de permiso de notificaciones. Se
   * llama una vez al arrancar la app (ver `bootstrap.ts`); no bloquea el
   * arranque si el usuario lo rechaza — la app sigue siendo usable sin
   * alarmas, solo con confirmación manual dentro de `PastilleroVirtualScreen`.
   */
  async requestPermissions(): Promise<void> {
    await notifee.requestPermission();
  }

  private handleEvent = async (event: NotifeeEvent): Promise<void> => {
    await handleNotifeeEvent(event, this.confirmDoseUseCase);
  };

  /** Cachea la promesa de creación de canales — idempotente, pero evita repetir la llamada nativa en cada notificación. */
  private ensureChannelsCreated(): Promise<void> {
    if (!this.channelsReadyPromise) {
      this.channelsReadyPromise = createNotificationChannels();
    }
    return this.channelsReadyPromise;
  }
}

/**
 * Handler de BACKGROUND, standalone — a propósito NO es un método de
 * `NotifeeNotificationScheduler`. Un evento en background puede llegar con
 * la app completamente cerrada (proceso matado); en ese caso React Native
 * arranca un contexto headless nuevo desde cero y NO hay ninguna instancia
 * previa "viva" a la que engancharse — cualquier estado inyectado en un
 * constructor ya no existe. Por eso este handler recibe una factory que
 * hace su propio bootstrap liviano en cada invocación, en vez de capturar
 * un `ConfirmDoseUseCase` ya construido.
 *
 * Uso real (en el `index.js` de la app — el entry point real de RN, NO
 * dentro de ningún componente — y ANTES de `AppRegistry.registerComponent`):
 *
 * ```ts
 * import notifee from '@notifee/react-native';
 * import { createBackgroundEventHandler } from './src/infrastructure/services/notifee/notifee-notification-scheduler';
 * import { bootstrap } from './src/infrastructure/bootstrap';
 *
 * notifee.onBackgroundEvent(
 *   createBackgroundEventHandler(async () => (await bootstrap()).confirmDose),
 * );
 * ```
 */
export function createBackgroundEventHandler(
  getConfirmDoseUseCase: () => Promise<ConfirmDoseUseCase>,
): (event: NotifeeEvent) => Promise<void> {
  return async (event: NotifeeEvent) => {
    // El `confirmDoseUseCase` solo se construye (bootstrap completo, abre
    // la DB) si el evento realmente lo necesita — "Posponer" no lo toca.
    await handleNotifeeEvent(event, null, getConfirmDoseUseCase);
  };
}

// ---------------------------------------------------------------------
// Funciones puras/compartidas — usadas tanto por el handler de foreground
// (instancia ya construida) como por el de background (factory perezosa).
// ---------------------------------------------------------------------

async function handleNotifeeEvent(
  event: NotifeeEvent,
  confirmDoseUseCase: ConfirmDoseUseCase | null,
  getConfirmDoseUseCase?: () => Promise<ConfirmDoseUseCase>,
): Promise<void> {
  if (event.type !== EventType.ACTION_PRESS) return;

  const notification = event.detail.notification;
  const actionId = event.detail.pressAction?.id;
  if (!notification?.id || !actionId) return;

  const doseId = doseIdFromNotificationId(notification.id);
  if (!doseId) return; // acción sobre una notificación que no es de toma (p. ej. alerta de stock)

  if (actionId === NOTIFEE_ACTIONS.snooze15) {
    await snoozeNotification(notification);
    return;
  }

  if (actionId !== NOTIFEE_ACTIONS.confirmDose) return;

  const patientId = notification.data?.patientId;
  if (typeof patientId !== 'string') return;

  const useCase = confirmDoseUseCase ?? (await getConfirmDoseUseCase?.());
  if (!useCase) return;

  const result = await useCase.execute({ doseId, requestingPatientId: patientId });
  if (result.ok) {
    await notifee.cancelNotification(notification.id!);
  }
  // Si falla (ya confirmada, stock insuficiente, tratamiento pausado...) se
  // deja la notificación visible a propósito: el usuario reintenta o abre
  // la app para ver el motivo — silenciar el error acá lo dejaría a ciegas.
}

/**
 * Reprograma la MISMA notificación (mismo id, se reemplaza — no duplica)
 * 15 minutos más tarde. Reutiliza el contenido tal cual venía en el
 * evento: no hace falta volver a consultar `Treatment`, todo lo necesario
 * para redibujar la notificación ya viajaba en ella.
 */
async function snoozeNotification(notification: NotifeeNotification): Promise<void> {
  const snoozeTimestamp = Date.now() + SNOOZE_MINUTES * 60 * 1000;
  await notifee.createTriggerNotification(notification, {
    type: TriggerType.TIMESTAMP,
    timestamp: snoozeTimestamp,
    alarmManager: { type: AlarmType.SET_EXACT_AND_ALLOW_WHILE_IDLE },
  });
}

function buildDoseNotification(dose: Dose, treatment: Treatment): NotifeeNotification {
  const dosageLabel = formatDosageLabel(treatment.dosageScheme.dosagePerTake);
  const body = treatment.visualProfile.slotLabel ? `${dosageLabel} — ${treatment.visualProfile.slotLabel}` : dosageLabel;

  return {
    id: doseNotificationId(dose.id),
    title: `Es hora de tomar ${treatment.medication.name}`,
    body,
    data: {
      doseId: dose.id,
      treatmentId: treatment.id,
      patientId: treatment.patientId,
    },
    android: {
      channelId: NOTIFEE_CHANNELS.doseReminders,
      importance: AndroidImportance.HIGH,
      smallIcon: 'ic_notification',
      category: AndroidCategory.ALARM,
      visibility: AndroidVisibility.PUBLIC, // contenido completo visible en pantalla de bloqueo
      ongoing: true, // no se descarta con un swipe accidental — solo con una acción explícita
      autoCancel: false,
      pressAction: { id: 'default' }, // tocar el cuerpo abre la app
      fullScreenAction: { id: 'default' }, // se muestra a pantalla completa incluso con el dispositivo bloqueado
      actions: [
        { title: 'Confirmar Toma', pressAction: { id: NOTIFEE_ACTIONS.confirmDose } },
        { title: 'Posponer 15 min', pressAction: { id: NOTIFEE_ACTIONS.snooze15 } },
      ],
    },
  };
}

async function createNotificationChannels(): Promise<void> {
  await notifee.createChannel({
    id: NOTIFEE_CHANNELS.doseReminders,
    name: 'Recordatorios de medicación',
    description: 'Avisos de toma programada — sonido de alarma y vibración continua.',
    importance: AndroidImportance.HIGH,
    visibility: AndroidVisibility.PUBLIC,
    sound: 'medical_alarm', // src/main/res/raw/medical_alarm.mp3 en la app RN — ver README
    vibration: true,
    // Sin el `0` inicial (el atajo típico de Android para "empezar ya"):
    // notifee valida `vibrationPattern` como array de valores POSITIVOS —
    // un 0 al principio lo rechaza en tiempo de ejecución
    // ("expected an array containing an even number of positive values"),
    // tumbando la creación del canal (y con eso, CUALQUIER notificación de
    // toma). Sin el 0 el patrón arranca inmediato igual.
    vibrationPattern: [500, 250, 500, 250, 500, 250], // patrón largo, distinguible de una notificación genérica
    bypassDnd: true, // una alarma de medicación debe sonar incluso en No Molestar
  });

  await notifee.createChannel({
    id: NOTIFEE_CHANNELS.stockAlerts,
    name: 'Alertas de stock',
    description: 'Avisos de reposición de medicación (no urgentes).',
    importance: AndroidImportance.HIGH,
    visibility: AndroidVisibility.PUBLIC,
    vibration: true,
  });
}
