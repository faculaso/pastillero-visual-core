import { useCallback, useEffect, useState } from 'react';
import type { NotificationScheduler } from '../../application';
import type { SyncDoseAlarmsUseCase } from '../../application';

export interface AlarmDiagnostics {
  readonly notificaciones: boolean | null;
  readonly alarmasExactas: boolean | null;
  readonly sueneEnSilencio: boolean | null;
  /** Cuántas alarmas tiene armadas HOY este teléfono. Cero con tratamientos activos es el síntoma. */
  readonly programadas: number | null;
  readonly proxima: Date | null;
}

export interface AlarmDiagnosticsState {
  readonly datos: AlarmDiagnostics;
  readonly cargando: boolean;
  /** `true` mientras el botón "Revisar ahora" está trabajando. */
  readonly revisando: boolean;
  readonly revisar: () => void;
  readonly leer: () => void;
}

const VACIO: AlarmDiagnostics = {
  notificaciones: null,
  alarmasExactas: null,
  sueneEnSilencio: null,
  programadas: null,
  proxima: null,
};

/**
 * Junta, en un solo lugar, todo lo que puede hacer que una alarma no suene.
 *
 * Existe porque cada una de estas cosas falla EN SILENCIO: el permiso de
 * notificaciones rechazado al instalar, las alarmas inexactas, el modo
 * silencio, o directamente un teléfono que no tiene ninguna alarma armada.
 * Ninguna tira error, ninguna se ve en pantalla, y averiguar cuál es por
 * teléfono con la persona del otro lado es imposible.
 *
 * Un `null` significa "no se pudo consultar", que NO es lo mismo que "está
 * mal" — la pantalla los muestra distinto a propósito.
 */
export function useAlarmDiagnostics(
  scheduler: NotificationScheduler,
  syncDoseAlarms: SyncDoseAlarmsUseCase,
  patientId: string,
): AlarmDiagnosticsState {
  const [datos, setDatos] = useState<AlarmDiagnostics>(VACIO);
  const [cargando, setCargando] = useState(true);
  const [revisando, setRevisando] = useState(false);

  const leerTodo = useCallback(async (): Promise<AlarmDiagnostics> => {
    const [permiso, exactas, silencio, armadas] = await Promise.all([
      scheduler.notificationsEnabled(),
      scheduler.exactAlarmsEnabled(),
      scheduler.doseAlarmBypassesDnd(),
      scheduler.scheduledDoseAlarms(),
    ]);

    const alarmas = armadas.ok ? [...armadas.value].sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime()) : null;

    return {
      notificaciones: permiso.ok ? permiso.value : null,
      alarmasExactas: exactas.ok ? exactas.value : null,
      sueneEnSilencio: silencio.ok ? silencio.value : null,
      programadas: alarmas ? alarmas.length : null,
      proxima: alarmas?.[0]?.scheduledAt ?? null,
    };
  }, [scheduler]);

  const leer = useCallback(() => {
    void (async () => {
      setCargando(true);
      setDatos(await leerTodo());
      setCargando(false);
    })();
  }, [leerTodo]);

  useEffect(leer, [leer]);

  const revisar = useCallback(() => {
    void (async () => {
      setRevisando(true);
      // Rearma antes de volver a medir: si faltaban alarmas, el botón las
      // pone además de mostrarlo. Que "revisar" arregle es deliberado —
      // pedirle a alguien que abra otra pantalla para reparar sería una
      // instrucción más por teléfono.
      await syncDoseAlarms.execute({ patientId });
      setDatos(await leerTodo());
      setRevisando(false);
    })();
  }, [leerTodo, syncDoseAlarms, patientId]);

  return { datos, cargando, revisando, revisar, leer };
}
