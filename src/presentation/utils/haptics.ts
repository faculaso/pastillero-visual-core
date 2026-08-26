import { Platform, Vibration } from 'react-native';

/**
 * `expo-haptics` no aplica acá: esta app es RN CLI puro, sin
 * `expo-modules-core` instalado (misma decisión que `PastilleroCompartment.vibrateLight`
 * y `NativeConfirmationFeedback`). `Vibration` es la API nativa que ya usa
 * el resto de la base de código para feedback táctil — un pulso corto es el
 * equivalente más cercano a `ImpactFeedbackStyle.Light` sin sumar
 * dependencias nuevas. Solo Android: iOS interpreta `Vibration.vibrate`
 * como un buzz fuerte de notificación, no un tap sutil.
 */
export function vibrateTap(): void {
  if (Platform.OS === 'android') {
    Vibration.vibrate(10);
  }
}

/** Patrón corto-pausa-corto — distinguible de un tap simple, para errores de validación/credenciales. */
export function vibrateError(): void {
  if (Platform.OS === 'android') {
    Vibration.vibrate([0, 25, 40, 25]);
  }
}

/** Doble pulso breve — confirma que una acción se completó (código de emparejamiento, toma confirmada). */
export function vibrateSuccess(): void {
  if (Platform.OS === 'android') {
    Vibration.vibrate([0, 15, 50, 15]);
  }
}
