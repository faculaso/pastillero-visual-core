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
    expect(screen.getByText('1 comprimido')).toBeTruthy();
  });

  it('pluraliza la dosis cuando es más de un comprimido', async () => {
    const dose = buildDoseView('2026-08-01T08:00:00.000');
    await render(
      withProviders(<CurrentDoseCard dose={{ ...dose, dosagePerTake: { ...dose.dosagePerTake, amount: 2 } }} />),
    );
    expect(screen.getByText('2 comprimidos')).toBeTruthy();
  });

  it('muestra el rótulo del showcase sobre el comprimido', async () => {
    await render(withProviders(<CurrentDoseCard dose={buildDoseView('2026-08-01T08:00:00.000')} />));
    expect(screen.getByText('Así se ve tu pastilla')).toBeTruthy();
  });

  it('muestra el texto de `slotLabel`, que antes se insinuaba con un punto vacío', async () => {
    // Regresión: `PillVisual` dibujaba un círculo azul relleno en la esquina
    // del comprimido cuando había `slotLabel` — se leía como un radio button
    // (invita a tocarlo) y NUNCA mostraba el dato. La voz ya lo leía en voz
    // alta, así que la pantalla estaba escondiendo algo que la app considera
    // importante.
    const dose = buildDoseView('2026-08-01T08:00:00.000');
    await render(
      withProviders(<CurrentDoseCard dose={{ ...dose, visualProfile: { ...dose.visualProfile, slotLabel: '250 MG' } }} />),
    );
    expect(screen.getByText('250 MG')).toBeTruthy();
  });

  it('no deja hueco cuando la toma no tiene `slotLabel`', async () => {
    await render(withProviders(<CurrentDoseCard dose={buildDoseView('2026-08-01T08:00:00.000')} />));
    expect(screen.queryByText('250 MG')).toBeNull();
  });
});
