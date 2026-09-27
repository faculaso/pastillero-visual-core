import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import type { NotificationScheduler } from '../../application';

export interface DndAccess {
  /** `true` solo si el dispositivo confirmó que la alarma HOY no suena en No Molestar. */
  readonly needsAccess: boolean;
  /** Manda a la persona a los ajustes del sistema. Al volver, el canal se repara solo. */
  readonly openSettings: () => void;
}

/**
 * Le pregunta al dispositivo si la alarma de toma suena con el teléfono en
 * No Molestar, y si no, ofrece el único arreglo posible.
 *
 * Por qué hace falta un viaje a los ajustes. `bypassDnd` es un ajuste de
 * canal que Android ignora en silencio salvo que la app tenga concedido
 * "Acceso a No molestar", y ese acceso NO tiene diálogo de permiso: se da
 * a mano en una pantalla del sistema. Lo único que puede hacer la app es
 * llevar hasta ahí y, al volver, rehacer el canal — sus ajustes no se
 * pueden editar, solo recrear.
 *
 * Por eso se reintenta al volver al foreground y no en cada arranque:
 * recrear el canal porque sí, en un teléfono donde la persona nunca va a
 * dar el acceso, sería borrarlo y rehacerlo para nada cada vez que abre la
 * app.
 */
export function useDndAccess(scheduler: NotificationScheduler): DndAccess {
  const [needsAccess, setNeedsAccess] = useState(false);
  // Solo se repara al volver de los ajustes. Sin esto, cualquier vuelta al
  // foreground (una llamada, mirar otra app) rehacería el canal.
  const fueALosAjustes = useRef(false);

  useEffect(() => {
    let vivo = true;
    void (async () => {
      const result = await scheduler.doseAlarmBypassesDnd();
      // Si la consulta falla no se muestra nada: un aviso de algo que no se
      // pudo comprobar es ruido, y encima sobre una pantalla cuyo trabajo es
      // que se vea UNA cosa.
      if (vivo && result.ok && !result.value) setNeedsAccess(true);
    })();
    return () => {
      vivo = false;
    };
  }, [scheduler]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (estado: AppStateStatus) => {
      if (estado !== 'active' || !fueALosAjustes.current) return;
      fueALosAjustes.current = false;
      void (async () => {
        const result = await scheduler.refreshDoseAlarmChannel();
        if (result.ok && result.value) setNeedsAccess(false);
      })();
    });
    return () => subscription.remove();
  }, [scheduler]);

  const openSettings = useCallback(() => {
    fueALosAjustes.current = true;
    void scheduler.openDndAccessSettings();
  }, [scheduler]);

  return { needsAccess, openSettings };
}
