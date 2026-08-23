import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { EmptyState } from '../../src/presentation/screens/pastillero-virtual/components/EmptyState';

describe('EmptyState', () => {
  it('muestra el mensaje neutro cuando no hay dailyProgress', async () => {
    await render(<EmptyState />);
    expect(screen.getByText('Por ahora no tenés tomas pendientes')).toBeTruthy();
  });

  it('muestra el mensaje neutro cuando no hay ninguna toma programada hoy (totalScheduled = 0)', async () => {
    await render(<EmptyState dailyProgress={{ totalScheduled: 0, totalTaken: 0 }} />);
    expect(screen.getByText('Por ahora no tenés tomas pendientes')).toBeTruthy();
  });

  it('muestra el mensaje festivo cuando se completaron TODAS las tomas de hoy', async () => {
    await render(<EmptyState dailyProgress={{ totalScheduled: 3, totalTaken: 3 }} />);
    expect(screen.getByText('¡Completaste todas tus tomas de hoy!')).toBeTruthy();
    expect(screen.queryByText('Por ahora no tenés tomas pendientes')).toBeNull();
  });

  it('muestra el mensaje neutro si todavía quedan tomas del día sin tomar', async () => {
    await render(<EmptyState dailyProgress={{ totalScheduled: 3, totalTaken: 1 }} />);
    expect(screen.getByText('Por ahora no tenés tomas pendientes')).toBeTruthy();
  });
});
