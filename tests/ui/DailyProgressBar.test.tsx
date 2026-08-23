import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { DailyProgressBar } from '../../src/presentation/screens/pastillero-virtual/components/DailyProgressBar';

describe('DailyProgressBar', () => {
  it('no renderiza nada si no hay tomas programadas hoy', async () => {
    const view = await render(<DailyProgressBar totalScheduled={0} totalTaken={0} />);
    expect(view.toJSON()).toBeNull();
  });

  it('muestra "X de Y tomas completadas"', async () => {
    await render(<DailyProgressBar totalScheduled={3} totalTaken={2} />);
    expect(screen.getByText('2 de 3 tomas completadas')).toBeTruthy();
  });

  it('expone accessibilityRole="progressbar" con el valor correcto', async () => {
    await render(<DailyProgressBar totalScheduled={4} totalTaken={1} />);
    const progressbar = screen.getByRole('progressbar');
    expect(progressbar.props.accessibilityValue).toEqual({ min: 0, max: 4, now: 1 });
  });

  it('el accessibilityLabel describe el progreso en palabras', async () => {
    await render(<DailyProgressBar totalScheduled={3} totalTaken={3} />);
    expect(screen.getByLabelText('3 de 3 tomas completadas hoy')).toBeTruthy();
  });
});
