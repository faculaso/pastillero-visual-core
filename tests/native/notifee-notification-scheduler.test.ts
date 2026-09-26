import { Ok, Err, DomainErrors, StockAlertLevel } from '../../src/domain';
import { buildTreatment, buildDose } from '../support/fixtures';

/**
 * El factory de `jest.mock` debe ser AUTOCONTENIDO: los `import` de este
 * archivo se hoistean por encima de cualquier `const` (así funciona ESM,
 * independientemente de en qué línea se escriban), así que una variable
 * externa como `const mockNotifee = {...}` declarada más abajo todavía NO
 * existiría cuando el factory corre (se dispara en cuanto algo hace
 * `require('@notifee/react-native')`, que ocurre al importar el scheduler
 * más abajo). Por eso los `jest.fn()` se crean DENTRO del factory, y se
 * recuperan después importando el default normal — misma instancia.
 */
jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: {
    createChannel: jest.fn().mockResolvedValue('channel-id'),
    deleteChannel: jest.fn().mockResolvedValue(undefined),
    getTriggerNotificationIds: jest.fn().mockResolvedValue([]),
    getTriggerNotifications: jest.fn().mockResolvedValue([]),
    createTriggerNotification: jest.fn().mockResolvedValue({ id: 'mock-id' }),
    cancelNotification: jest.fn().mockResolvedValue(undefined),
    displayNotification: jest.fn().mockResolvedValue('notif-id'),
    onForegroundEvent: jest.fn(),
    onBackgroundEvent: jest.fn(),
    requestPermission: jest.fn().mockResolvedValue({ authorizationStatus: 1 }),
  },
  AndroidImportance: { NONE: 0, MIN: 1, LOW: 2, DEFAULT: 3, HIGH: 4 },
  AndroidVisibility: { SECRET: -1, PRIVATE: 0, PUBLIC: 1 },
  AndroidCategory: { ALARM: 'alarm', REMINDER: 'reminder' },
  AlarmType: { SET: 0, SET_AND_ALLOW_WHILE_IDLE: 1, SET_EXACT: 2, SET_EXACT_AND_ALLOW_WHILE_IDLE: 3 },
  TriggerType: { TIMESTAMP: 0, INTERVAL: 1 },
  EventType: { UNKNOWN: -1, DISMISSED: 0, PRESS: 1, ACTION_PRESS: 2, DELIVERED: 3 },
}));

// Mismo import "real" que usa el código fuente: bajo el mock, resuelve al
// MISMO objeto que ve `NotifeeNotificationScheduler` — perfecto para assertions.
import notifeeDefault from '@notifee/react-native';
import {
  NotifeeNotificationScheduler,
  createBackgroundEventHandler,
} from '../../src/infrastructure/services/notifee/notifee-notification-scheduler';
import {
  NOTIFEE_CHANNELS,
  LEGACY_DOSE_CHANNEL,
} from '../../src/infrastructure/services/notifee/notifee-constants';

interface MockNotifee {
  createChannel: jest.Mock;
  deleteChannel: jest.Mock;
  getTriggerNotificationIds: jest.Mock;
  getTriggerNotifications: jest.Mock;
  createTriggerNotification: jest.Mock;
  cancelNotification: jest.Mock;
  displayNotification: jest.Mock;
  onForegroundEvent: jest.Mock;
  onBackgroundEvent: jest.Mock;
  requestPermission: jest.Mock;
}

const mockNotifee = notifeeDefault as unknown as MockNotifee;

function buildConfirmDoseUseCase() {
  return { execute: jest.fn() };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockNotifee.createTriggerNotification.mockResolvedValue({ id: 'mock-id' });
});

describe('NotifeeNotificationScheduler — puerto NotificationScheduler', () => {
  it('scheduleDoseAlarm crea los canales y programa una TriggerNotification con id/título/cuerpo correctos', async () => {
    const confirmDoseUseCase = buildConfirmDoseUseCase();
    const scheduler = new NotifeeNotificationScheduler(confirmDoseUseCase as never);

    const treatment = buildTreatment({ id: 'treatment-1', patientId: 'patient-1' });
    const dose = buildDose({ id: 'dose-1', treatmentId: 'treatment-1', scheduledAt: new Date('2026-08-01T08:00:00.000Z') });

    const result = await scheduler.scheduleDoseAlarm(dose, treatment);

    expect(result).toEqual({ ok: true, value: undefined });
    expect(mockNotifee.createChannel).toHaveBeenCalledTimes(2); // dose-alarms + stock-alerts

    expect(mockNotifee.createTriggerNotification).toHaveBeenCalledTimes(1);
    const [notification, trigger] = mockNotifee.createTriggerNotification.mock.calls[0];
    expect(notification.id).toBe('dose-dose-1');
    expect(notification.title).toContain(treatment.medication.name);
    expect(notification.data).toEqual({ doseId: 'dose-1', treatmentId: 'treatment-1', patientId: 'patient-1' });
    expect(notification.android.channelId).toBe(NOTIFEE_CHANNELS.doseAlarms);
    expect(notification.android.actions).toEqual([
      { title: 'Confirmar Toma', pressAction: { id: 'confirm-dose' } },
      { title: 'Posponer 15 min', pressAction: { id: 'snooze-15' } },
    ]);
    expect(trigger.timestamp).toBe(dose.scheduledAt.getTime());
  });

  it('la alarma de toma suena en loop: un solo pitido se duerme y la toma se pierde', async () => {
    const scheduler = new NotifeeNotificationScheduler(buildConfirmDoseUseCase() as never);

    await scheduler.scheduleDoseAlarm(buildDose({ id: 'd1' }), buildTreatment());

    const [notification] = mockNotifee.createTriggerNotification.mock.calls[0];
    expect(notification.android.loopSound).toBe(true);
    // El loop solo es tolerable porque la notificación NO se descarta de un
    // swipe: se apaga confirmando o posponiendo, como un despertador.
    expect(notification.android.ongoing).toBe(true);
    expect(notification.android.fullScreenAction).toEqual({ id: 'default' });
  });

  it('borra el canal viejo de tomas: sus ajustes de sonido son inmutables', async () => {
    // Android no deja cambiarle el sonido ni la vibración a un canal ya
    // creado. En un teléfono que ya tenía la app, dejarlo vivo significaba
    // que la alarma seguiría sonando como una notificación cualquiera.
    const scheduler = new NotifeeNotificationScheduler(buildConfirmDoseUseCase() as never);

    await scheduler.scheduleDoseAlarm(buildDose({ id: 'd1' }), buildTreatment());

    expect(mockNotifee.deleteChannel).toHaveBeenCalledWith(LEGACY_DOSE_CHANNEL);
    expect(LEGACY_DOSE_CHANNEL).not.toBe(NOTIFEE_CHANNELS.doseAlarms);
  });

  it('el canal de alarmas ignora No Molestar y vibra con patrón largo', async () => {
    const scheduler = new NotifeeNotificationScheduler(buildConfirmDoseUseCase() as never);

    await scheduler.scheduleDoseAlarm(buildDose({ id: 'd1' }), buildTreatment());

    const canalDeTomas = mockNotifee.createChannel.mock.calls
      .map((call: unknown[]) => call[0] as { id: string; bypassDnd?: boolean; vibrationPattern?: number[] })
      .find((canal) => canal.id === NOTIFEE_CHANNELS.doseAlarms);
    expect(canalDeTomas?.bypassDnd).toBe(true);
    expect(canalDeTomas?.vibrationPattern?.length).toBeGreaterThan(2);
  });

  it('crea los canales una sola vez aunque se programen varias alarmas', async () => {
    const scheduler = new NotifeeNotificationScheduler(buildConfirmDoseUseCase() as never);
    const treatment = buildTreatment();

    await scheduler.scheduleDoseAlarm(buildDose({ id: 'd1' }), treatment);
    await scheduler.scheduleDoseAlarm(buildDose({ id: 'd2' }), treatment);

    expect(mockNotifee.createChannel).toHaveBeenCalledTimes(2); // no 4 — cacheado tras la primera vez
  });

  it('cancelDoseAlarm cancela por el id prefijado dose-<id>', async () => {
    const scheduler = new NotifeeNotificationScheduler(buildConfirmDoseUseCase() as never);
    const result = await scheduler.cancelDoseAlarm('dose-1');

    expect(result).toEqual({ ok: true, value: undefined });
    expect(mockNotifee.cancelNotification).toHaveBeenCalledWith('dose-dose-1');
  });

  it('dispatchStockAlert muestra una notificación con el nombre del medicamento y los días restantes', async () => {
    const scheduler = new NotifeeNotificationScheduler(buildConfirmDoseUseCase() as never);
    const treatment = buildTreatment({ id: 'treatment-1', medication: { id: 'm1', name: 'Paracetamol', activeIngredient: 'x', laboratory: 'x', presentation: 'x' } });

    const result = await scheduler.dispatchStockAlert(treatment, StockAlertLevel.CRITICAL, 2);

    expect(result).toEqual({ ok: true, value: undefined });
    const [notification] = mockNotifee.displayNotification.mock.calls[0];
    expect(notification.id).toBe('stock-treatment-1');
    expect(notification.title).toContain('Paracetamol');
    expect(notification.body).toContain('2');
    expect(notification.android.channelId).toBe(NOTIFEE_CHANNELS.stockAlerts);
  });

  it('clearStockAlert cancela por el id prefijado stock-<treatmentId>', async () => {
    const scheduler = new NotifeeNotificationScheduler(buildConfirmDoseUseCase() as never);
    await scheduler.clearStockAlert('treatment-1');
    expect(mockNotifee.cancelNotification).toHaveBeenCalledWith('stock-treatment-1');
  });

  it('propaga fallas nativas como REPOSITORY_FAILURE en vez de lanzar', async () => {
    mockNotifee.createTriggerNotification.mockRejectedValueOnce(new Error('native crash'));
    const scheduler = new NotifeeNotificationScheduler(buildConfirmDoseUseCase() as never);

    const result = await scheduler.scheduleDoseAlarm(buildDose(), buildTreatment());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('REPOSITORY_FAILURE');
  });

  it('registerForegroundHandler registra el handler contra notifee.onForegroundEvent', () => {
    const scheduler = new NotifeeNotificationScheduler(buildConfirmDoseUseCase() as never);
    scheduler.registerForegroundHandler();
    expect(mockNotifee.onForegroundEvent).toHaveBeenCalledTimes(1);
    expect(mockNotifee.onBackgroundEvent).not.toHaveBeenCalled(); // eso es responsabilidad del index.js, no de esta clase
  });

  it('requestPermissions llama a notifee.requestPermission (Android 13+/iOS)', async () => {
    const scheduler = new NotifeeNotificationScheduler(buildConfirmDoseUseCase() as never);
    await scheduler.requestPermissions();
    expect(mockNotifee.requestPermission).toHaveBeenCalledTimes(1);
  });

  it('requestPermissions también deja los canales creados — en un teléfono de Cuidador es la única oportunidad', async () => {
    // Ahí la app ya no programa ninguna alarma, así que si los canales se
    // crearan recién al programar, el canal viejo no se borraría nunca.
    const scheduler = new NotifeeNotificationScheduler(buildConfirmDoseUseCase() as never);
    await scheduler.requestPermissions();
    expect(mockNotifee.deleteChannel).toHaveBeenCalledWith(LEGACY_DOSE_CHANNEL);
    expect(mockNotifee.createChannel).toHaveBeenCalledWith(
      expect.objectContaining({ id: NOTIFEE_CHANNELS.doseAlarms }),
    );
  });

  it('scheduledDoseAlarms devuelve id + hora de cada alarma de toma, y descarta lo que no lo es', async () => {
    // La hora es el dato que permite distinguir una alarma legítima de más
    // allá del horizonte de una que quedó colgada de otro paciente.
    mockNotifee.getTriggerNotifications.mockResolvedValueOnce([
      { notification: { id: 'dose-abc' }, trigger: { type: 0, timestamp: 1_700_000_000_000 } },
      { notification: { id: 'stock-xyz' }, trigger: { type: 0, timestamp: 1_700_000_000_000 } },
      { notification: { id: 'dose-intervalo' }, trigger: { type: 1, interval: 30 } },
    ]);
    const scheduler = new NotifeeNotificationScheduler(buildConfirmDoseUseCase() as never);

    const result = await scheduler.scheduledDoseAlarms();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual([{ doseId: 'abc', scheduledAt: new Date(1_700_000_000_000) }]);
  });

  it('scheduledDoseAlarms falla como REPOSITORY_FAILURE si notifee no puede listar', async () => {
    mockNotifee.getTriggerNotifications.mockRejectedValueOnce(new Error('notifee down'));
    const scheduler = new NotifeeNotificationScheduler(buildConfirmDoseUseCase() as never);

    const result = await scheduler.scheduledDoseAlarms();

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('REPOSITORY_FAILURE');
  });
});

describe('NotifeeNotificationScheduler — acciones interactivas (foreground)', () => {
  function getRegisteredHandler(scheduler: NotifeeNotificationScheduler) {
    scheduler.registerForegroundHandler();
    return mockNotifee.onForegroundEvent.mock.calls[0][0] as (event: unknown) => Promise<void>;
  }

  it('"Confirmar Toma" llama a ConfirmDoseUseCase con doseId y patientId, y cancela la notificación si tuvo éxito', async () => {
    const confirmDoseUseCase = buildConfirmDoseUseCase();
    confirmDoseUseCase.execute.mockResolvedValue(Ok({ dose: {}, stock: {} }));
    const scheduler = new NotifeeNotificationScheduler(confirmDoseUseCase as never);
    const handler = getRegisteredHandler(scheduler);

    await handler({
      type: 2, // ACTION_PRESS
      detail: {
        notification: { id: 'dose-dose-1', data: { patientId: 'patient-1' } },
        pressAction: { id: 'confirm-dose' },
      },
    });

    expect(confirmDoseUseCase.execute).toHaveBeenCalledWith({ doseId: 'dose-1', requestingPatientId: 'patient-1' });
    expect(mockNotifee.cancelNotification).toHaveBeenCalledWith('dose-dose-1');
  });

  it('"Confirmar Toma" NO cancela la notificación si ConfirmDoseUseCase falla', async () => {
    const confirmDoseUseCase = buildConfirmDoseUseCase();
    confirmDoseUseCase.execute.mockResolvedValue(Err(DomainErrors.doseAlreadyConfirmed('dose-1')));
    const scheduler = new NotifeeNotificationScheduler(confirmDoseUseCase as never);
    const handler = getRegisteredHandler(scheduler);

    await handler({
      type: 2,
      detail: {
        notification: { id: 'dose-dose-1', data: { patientId: 'patient-1' } },
        pressAction: { id: 'confirm-dose' },
      },
    });

    expect(mockNotifee.cancelNotification).not.toHaveBeenCalled();
  });

  it('"Posponer 15 min" reprograma la MISMA notificación ~15 minutos después, sin llamar a ConfirmDoseUseCase', async () => {
    const confirmDoseUseCase = buildConfirmDoseUseCase();
    const scheduler = new NotifeeNotificationScheduler(confirmDoseUseCase as never);
    const handler = getRegisteredHandler(scheduler);

    const originalNotification = { id: 'dose-dose-1', title: 'Es hora de tomar X', data: { patientId: 'patient-1' } };
    const before = Date.now();

    await handler({
      type: 2,
      detail: { notification: originalNotification, pressAction: { id: 'snooze-15' } },
    });

    expect(confirmDoseUseCase.execute).not.toHaveBeenCalled();
    const [notification, trigger] = mockNotifee.createTriggerNotification.mock.calls.at(-1)!;
    expect(notification).toBe(originalNotification); // mismo objeto/id -> reemplaza, no duplica
    expect(trigger.timestamp).toBeGreaterThanOrEqual(before + 15 * 60 * 1000 - 1000);
    expect(trigger.timestamp).toBeLessThanOrEqual(before + 15 * 60 * 1000 + 5000);
  });

  it('ignora acciones sobre notificaciones que no son de toma (p. ej. alerta de stock)', async () => {
    const confirmDoseUseCase = buildConfirmDoseUseCase();
    const scheduler = new NotifeeNotificationScheduler(confirmDoseUseCase as never);
    const handler = getRegisteredHandler(scheduler);

    await handler({
      type: 2,
      detail: { notification: { id: 'stock-treatment-1' }, pressAction: { id: 'confirm-dose' } },
    });

    expect(confirmDoseUseCase.execute).not.toHaveBeenCalled();
  });

  it('ignora eventos que no son ACTION_PRESS', async () => {
    const confirmDoseUseCase = buildConfirmDoseUseCase();
    const scheduler = new NotifeeNotificationScheduler(confirmDoseUseCase as never);
    const handler = getRegisteredHandler(scheduler);

    await handler({
      type: 1, // PRESS, no ACTION_PRESS
      detail: { notification: { id: 'dose-dose-1' }, pressAction: { id: 'confirm-dose' } },
    });

    expect(confirmDoseUseCase.execute).not.toHaveBeenCalled();
  });
});

describe('createBackgroundEventHandler — headless, sin instancia previa', () => {
  it('hace bootstrap perezoso SOLO cuando la acción es confirmar (no para posponer)', async () => {
    const confirmDoseUseCase = buildConfirmDoseUseCase();
    confirmDoseUseCase.execute.mockResolvedValue(Ok({ dose: {}, stock: {} }));
    const getConfirmDoseUseCase = jest.fn().mockResolvedValue(confirmDoseUseCase);
    const handler = createBackgroundEventHandler(getConfirmDoseUseCase as never);

    await handler({
      type: 2,
      detail: { notification: { id: 'dose-dose-1', data: { patientId: 'patient-1' } }, pressAction: { id: 'snooze-15' } },
    } as never);

    expect(getConfirmDoseUseCase).not.toHaveBeenCalled();
    expect(mockNotifee.createTriggerNotification).toHaveBeenCalled(); // el snooze sí actuó
  });

  it('resuelve el use case perezosamente y confirma la toma cuando la acción es confirmar', async () => {
    const confirmDoseUseCase = buildConfirmDoseUseCase();
    confirmDoseUseCase.execute.mockResolvedValue(Ok({ dose: {}, stock: {} }));
    const getConfirmDoseUseCase = jest.fn().mockResolvedValue(confirmDoseUseCase);
    const handler = createBackgroundEventHandler(getConfirmDoseUseCase as never);

    await handler({
      type: 2,
      detail: { notification: { id: 'dose-dose-1', data: { patientId: 'patient-1' } }, pressAction: { id: 'confirm-dose' } },
    } as never);

    expect(getConfirmDoseUseCase).toHaveBeenCalledTimes(1);
    expect(confirmDoseUseCase.execute).toHaveBeenCalledWith({ doseId: 'dose-1', requestingPatientId: 'patient-1' });
    expect(mockNotifee.cancelNotification).toHaveBeenCalledWith('dose-dose-1');
  });
});
