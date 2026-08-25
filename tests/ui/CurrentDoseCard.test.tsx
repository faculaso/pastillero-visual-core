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

/**
 * El badge de turno (Mañana/Tarde/Noche) y el `InstructionBadge` ya NO
 * viven acá — se movieron a `PastilleroVirtualScreen`, que es quien tiñe el
 * fondo de PANTALLA según el turno (ver PastilleroVirtualScreen.test.tsx).
 * Esta tarjeta es siempre blanca: solo el "showcase" del comprimido, el
 * nombre y la dosis.
 */
describe('CurrentDoseCard', () => {
  it('muestra el nombre del medicamento y la dosis', async () => {
    await render(withProviders(<CurrentDoseCard dose={buildDoseView('2026-08-01T08:00:00.000')} />));
    expect(screen.getByText('Paracetamol')).toBeTruthy();
    expect(screen.getByText('1 comprimido(s)')).toBeTruthy();
  });

  it('muestra el rótulo "Aspecto exacto" sobre el showcase del comprimido', async () => {
    await render(withProviders(<CurrentDoseCard dose={buildDoseView('2026-08-01T08:00:00.000')} />));
    expect(screen.getByText('Aspecto exacto')).toBeTruthy();
  });
});
