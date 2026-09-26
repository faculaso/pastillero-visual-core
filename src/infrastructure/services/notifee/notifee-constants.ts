/**
 * IDs de canal de Android. `dose-alarms` es el canal de alarma de toma
 * (máxima importancia, sonido en loop, ignora No Molestar, visible en
 * pantalla de bloqueo); `stock-alerts` es una notificación informativa
 * normal — no amerita el mismo nivel de intrusión que "es hora de tomar la
 * pastilla".
 */
export const NOTIFEE_CHANNELS = {
  doseAlarms: 'dose-alarms',
  stockAlerts: 'stock-alerts',
} as const;

/**
 * El canal anterior de tomas. Android NO deja cambiarle el sonido, la
 * vibración ni el `bypassDnd` a un canal ya creado: la única forma de que
 * la alarma pase a comportarse como un despertador era crear uno nuevo.
 * Este se borra al arrancar para que no quede de adorno en los ajustes del
 * teléfono de quien ya tenía la app instalada.
 */
export const LEGACY_DOSE_CHANNEL = 'dose-reminders';

/** IDs de las acciones rápidas de la notificación de toma. */
export const NOTIFEE_ACTIONS = {
  confirmDose: 'confirm-dose',
  snooze15: 'snooze-15',
} as const;

const DOSE_NOTIFICATION_PREFIX = 'dose-';
const STOCK_NOTIFICATION_PREFIX = 'stock-';

export function doseNotificationId(doseId: string): string {
  return `${DOSE_NOTIFICATION_PREFIX}${doseId}`;
}

export function stockNotificationId(treatmentId: string): string {
  return `${STOCK_NOTIFICATION_PREFIX}${treatmentId}`;
}

/** `null` si el id no corresponde a una notificación de toma (p. ej. es la de stock). */
export function doseIdFromNotificationId(notificationId: string | undefined): string | null {
  if (!notificationId?.startsWith(DOSE_NOTIFICATION_PREFIX)) return null;
  return notificationId.slice(DOSE_NOTIFICATION_PREFIX.length);
}
