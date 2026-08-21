/**
 * IDs de canal de Android. `dose-reminders` es el canal "de alarma médica"
 * (máxima importancia, sonido propio, visible en pantalla de bloqueo);
 * `stock-alerts` es una notificación informativa normal — no amerita el
 * mismo nivel de intrusión que "es hora de tomar la pastilla".
 */
export const NOTIFEE_CHANNELS = {
  doseReminders: 'dose-reminders',
  stockAlerts: 'stock-alerts',
} as const;

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
