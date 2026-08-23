import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { CurrentDoseCard } from '../../src/presentation/screens/pastillero-virtual/components/CurrentDoseCard';
import { PillShape, MeasurementUnit } from '../../src/domain';
import type { PendingDoseView } from '../../src/application';
import { withProviders } from './test-utils';

function buildDoseView(scheduledAt: string): PendingDoseView {
  return {
    doseId: 'dose-1',
    treatmentId: 'treatment-1',
    scheduledAt: new Date(scheduledAt),
    medicationName: 'Paracetamol',
    visualProfile: { shape: PillShape.ROUND, color: '#FFFFFF' },
    dosagePerTake: { amount: 1, unit: MeasurementUnit.UNIT },
  };
}

describe('CurrentDoseCard', () => {
  it('muestra el badge de turno "Mañana" para una toma matutina', async () => {
    await render(withProviders(<CurrentDoseCard dose={buildDoseView('2026-08-01T08:00:00.000')} />));
    expect(screen.getByText(/Mañana/)).toBeTruthy();
    expect(screen.getByText('Tomar con agua')).toBeTruthy();
  });

  it('muestra el badge de turno "Tarde" para una toma de la tarde', async () => {
    await render(withProviders(<CurrentDoseCard dose={buildDoseView('2026-08-01T14:00:00.000')} />));
    expect(screen.getByText(/Tarde/)).toBeTruthy();
    expect(screen.getByText('Tomar después de comer')).toBeTruthy();
  });

  it('muestra el badge de turno "Noche" para una toma nocturna', async () => {
    await render(withProviders(<CurrentDoseCard dose={buildDoseView('2026-08-01T21:00:00.000')} />));
    expect(screen.getByText(/Noche/)).toBeTruthy();
    expect(screen.getByText('Tomar antes de dormir')).toBeTruthy();
  });

  it('sigue mostrando el nombre del medicamento y la dosis', async () => {
    await render(withProviders(<CurrentDoseCard dose={buildDoseView('2026-08-01T08:00:00.000')} />));
    expect(screen.getByText('Paracetamol')).toBeTruthy();
    expect(screen.getByText('1 comprimido(s)')).toBeTruthy();
  });
});
