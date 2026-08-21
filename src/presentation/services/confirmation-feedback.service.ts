import { Vibration } from 'react-native';

/**
 * CU-02 paso 5: "El sistema emite confirmación auditiva/táctil". Se define
 * como interfaz (no un objeto suelto) para poder testear componentes que la
 * usan sin depender de la API real de vibración/audio del dispositivo.
 *
 * Vive en PRESENTACIÓN, no en aplicación: a diferencia de `NotificationScheduler`
 * (que dispara alarmas del OS incluso con la app cerrada, un requisito de
 * negocio de CU-02/CU-03), este feedback solo tiene sentido con la pantalla
 * abierta — es UX pura, no una invariante de negocio.
 */
export interface ConfirmationFeedback {
  playSuccess(): void;
}

/**
 * Implementación con la API nativa de RN (`Vibration`), sin dependencias
 * externas. El chime de audio queda como extensión futura (p. ej.
 * `expo-av`) — se deja el método `playSuccess` como el único punto de
 * cambio, el resto de la app no sabe cómo se implementa el feedback.
 */
export class NativeConfirmationFeedback implements ConfirmationFeedback {
  playSuccess(): void {
    // Patrón corto-pausa-corto: distinguible de una vibración de notificación genérica.
    Vibration.vibrate([0, 80, 60, 80]);
  }
}
