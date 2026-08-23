import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { InstructionBadge } from '../../src/presentation/screens/pastillero-virtual/components/InstructionBadge';
import { getTimeOfDayTheme } from '../../src/presentation/utils/time-of-day-theme';

describe('InstructionBadge', () => {
  it('muestra el ícono y el label de instrucción del turno mañana', async () => {
    const theme = getTimeOfDayTheme(new Date('2026-08-01T08:00:00.000'));
    await render(<InstructionBadge theme={theme} />);
    expect(screen.getByText('💧')).toBeTruthy();
    expect(screen.getByText('Tomar con agua')).toBeTruthy();
  });

  it('muestra la instrucción de la noche (antes de dormir)', async () => {
    const theme = getTimeOfDayTheme(new Date('2026-08-01T21:00:00.000'));
    await render(<InstructionBadge theme={theme} />);
    expect(screen.getByText('🌙')).toBeTruthy();
    expect(screen.getByText('Tomar antes de dormir')).toBeTruthy();
  });

  it('expone el label completo como accessibilityLabel', async () => {
    const theme = getTimeOfDayTheme(new Date('2026-08-01T14:00:00.000'));
    await render(<InstructionBadge theme={theme} />);
    expect(screen.getByLabelText('Tomar después de comer')).toBeTruthy();
  });
});
