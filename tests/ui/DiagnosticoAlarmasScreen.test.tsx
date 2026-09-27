import React from 'react';
import { render, screen, waitFor, userEvent } from '@testing-library/react-native';
import { DiagnosticoAlarmasScreen } from '../../src/presentation/screens/diagnostico/DiagnosticoAlarmasScreen';
import { Ok, Err, DomainErrors } from '../../src/domain';
import { withProviders } from './test-utils';

function buildNavigationMock() {
  return { navigate: jest.fn(), goBack: jest.fn() } as unknown as Parameters<
    typeof DiagnosticoAlarmasScreen
  >[0]['navigation'];
}

/** Todo bien por defecto; cada test rompe solo lo suyo. */
function buildScheduler(overrides: Record<string, unknown> = {}) {
  return {
    notificationsEnabled: jest.fn().mockResolvedValue(Ok(true)),
    exactAlarmsEnabled: jest.fn().mockResolvedValue(Ok(true)),
    doseAlarmBypassesDnd: jest.fn().mockResolvedValue(Ok(true)),
    scheduledDoseAlarms: jest.fn().mockResolvedValue(Ok([])),
    openNotificationSettings: jest.fn().mockResolvedValue(Ok(undefined)),
    openDndAccessSettings: jest.fn().mockResolvedValue(Ok(undefined)),
    ...overrides,
  };
}

function renderPantalla(scheduler: ReturnType<typeof buildScheduler>, syncDoseAlarms?: unknown) {
  return render(
    withProviders(<DiagnosticoAlarmasScreen patientId="patient-1" navigation={buildNavigationMock()} />, {
      useCases: {
        notificationScheduler: scheduler as never,
        ...(syncDoseAlarms ? { syncDoseAlarms: syncDoseAlarms as never } : {}),
      },
    }),
  );
}

describe('DiagnosticoAlarmasScreen', () => {
  it('canta el número de alarmas armadas y cuándo suena la próxima', async () => {
    const enDosHoras = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const scheduler = buildScheduler({
      scheduledDoseAlarms: jest.fn().mockResolvedValue(
        Ok([
          { doseId: 'd2', scheduledAt: new Date(Date.now() + 26 * 60 * 60 * 1000) },
          { doseId: 'd1', scheduledAt: enDosHoras },
        ]),
      ),
    });

    await renderPantalla(scheduler);

    await waitFor(() => expect(screen.getByText('2')).toBeTruthy());
    // La más cercana, no la primera que vino en la lista. El texto exacto
    // depende de la hora del día, así que la redacción se prueba aparte en
    // `describe-next-alarm.test.ts`, con fechas fijas.
    const hora = enDosHoras.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
    expect(screen.getByText(new RegExp(`La próxima,.*${hora}`))).toBeTruthy();
  });

  it('un teléfono sin ninguna alarma lo dice con todas las letras — es EL síntoma', async () => {
    await renderPantalla(buildScheduler());

    await waitFor(() =>
      expect(screen.getByText('Este teléfono no tiene ninguna alarma puesta')).toBeTruthy(),
    );
  });

  it('avisa que los avisos están apagados y ofrece abrir los ajustes', async () => {
    const scheduler = buildScheduler({
      notificationsEnabled: jest.fn().mockResolvedValue(Ok(false)),
    });

    await renderPantalla(scheduler);

    await waitFor(() => expect(screen.getByText('El teléfono tiene los avisos apagados')).toBeTruthy());
    await userEvent.setup().press(screen.getByText('Permitir avisos'));
    expect(scheduler.openNotificationSettings).toHaveBeenCalledTimes(1);
  });

  it('ofrece el arreglo de No Molestar solo cuando hace falta', async () => {
    const scheduler = buildScheduler({ doseAlarmBypassesDnd: jest.fn().mockResolvedValue(Ok(false)) });

    await renderPantalla(scheduler);

    await waitFor(() =>
      expect(screen.getByText('Con el teléfono en silencio no va a sonar')).toBeTruthy(),
    );
    await userEvent.setup().press(screen.getByText('Que suene siempre'));
    expect(scheduler.openDndAccessSettings).toHaveBeenCalledTimes(1);
  });

  it('no muestra los botones de arreglo cuando está todo bien', async () => {
    await renderPantalla(buildScheduler());

    await waitFor(() => expect(screen.getByText('El teléfono puede mostrar avisos')).toBeTruthy());
    expect(screen.queryByText('Permitir avisos')).toBeNull();
    expect(screen.queryByText('Que suene siempre')).toBeNull();
  });

  it('"no se pudo consultar" no es lo mismo que "está mal"', async () => {
    // Mandar a alguien a tocar ajustes por algo que no se pudo averiguar es
    // peor que no decir nada.
    const scheduler = buildScheduler({
      notificationsEnabled: jest.fn().mockResolvedValue(Err(DomainErrors.repositoryFailure(new Error('boom')))),
    });

    await renderPantalla(scheduler);

    await waitFor(() => expect(screen.getByText('No se pudo consultar')).toBeTruthy());
    expect(screen.queryByText('Permitir avisos')).toBeNull();
  });

  it('"Revisar ahora" rearma las alarmas y vuelve a medir', async () => {
    const syncDoseAlarms = {
      execute: jest.fn().mockResolvedValue(Ok({ scheduledCount: 3, cancelledCount: 0, alarmWarnings: [] })),
    };
    const scheduledDoseAlarms = jest
      .fn()
      .mockResolvedValueOnce(Ok([]))
      .mockResolvedValue(Ok([{ doseId: 'd1', scheduledAt: new Date(Date.now() + 60 * 60 * 1000) }]));
    const scheduler = buildScheduler({ scheduledDoseAlarms });

    await renderPantalla(scheduler, syncDoseAlarms);

    await waitFor(() =>
      expect(screen.getByText('Este teléfono no tiene ninguna alarma puesta')).toBeTruthy(),
    );

    await userEvent.setup().press(screen.getByText('Revisar ahora'));

    expect(syncDoseAlarms.execute).toHaveBeenCalledWith({ patientId: 'patient-1' });
    await waitFor(() => expect(screen.getByText('alarma puesta en este teléfono')).toBeTruthy());
  });
});
