import React, { useState } from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';
import { DosageAndStockForm, type DosageAndStockFormValue } from '../../src/presentation/screens/register-treatment/components/DosageAndStockForm';
import { MeasurementUnit } from '../../src/domain';
import { withProviders } from './test-utils';

const INITIAL: DosageAndStockFormValue = {
  timeHour: '08',
  timeMinute: '00',
  dosageAmount: '1',
  dosageUnit: MeasurementUnit.UNIT,
  initialStock: '30',
  dailyConsumption: '1',
  allDays: true,
  weekdays: [],
  startOffsetDays: 0,
  durationDays: null,
};

function StatefulForm({ onChangeSpy }: { onChangeSpy: (v: DosageAndStockFormValue) => void }) {
  const [value, setValue] = useState(INITIAL);
  return (
    <DosageAndStockForm
      value={value}
      onChange={(v) => {
        setValue(v);
        onChangeSpy(v);
      }}
    />
  );
}

describe('DosageAndStockForm — checkbox "Todos los días"', () => {
  it('arranca tildado y se puede destildar/tildar, sin mostrar un selector de días sueltos', async () => {
    const onChangeSpy = jest.fn();
    const user = userEvent.setup();
    await render(withProviders(<StatefulForm onChangeSpy={onChangeSpy} />));

    expect(screen.getByLabelText('Todos los días').props.accessibilityState.checked).toBe(true);
    expect(screen.queryByLabelText('Domingo')).toBeNull();

    await user.press(screen.getByLabelText('Todos los días'));
    expect(onChangeSpy).toHaveBeenLastCalledWith(expect.objectContaining({ allDays: false }));
    expect(screen.getByLabelText('Todos los días').props.accessibilityState.checked).toBe(false);
    expect(screen.queryByLabelText('Domingo')).toBeNull();

    await user.press(screen.getByLabelText('Todos los días'));
    expect(screen.getByLabelText('Todos los días').props.accessibilityState.checked).toBe(true);
  });
});

describe('fechas del tratamiento', () => {
  it('elegir una duración deja de ser crónico y lo informa en palabras', async () => {
    // Sin fecha de fin, un tratamiento de 7 días generaba igual las dosis de
    // los 30 días del horizonte: 23 tomas fantasma que suenan la alarma y
    // cuentan como incumplidas.
    const user = userEvent.setup();
    const onChangeSpy = jest.fn();
    await render(withProviders(<StatefulForm onChangeSpy={onChangeSpy} />));

    expect(screen.getByText(/sin fecha de fin\./i)).toBeTruthy();

    await user.press(screen.getByLabelText('7 días'));

    expect(onChangeSpy).toHaveBeenCalledWith(expect.objectContaining({ durationDays: 7 }));
    expect(screen.getByText(/^Desde hoy hasta el /)).toBeTruthy();
  });

  it('se puede arrancar otro día de la semana', async () => {
    const user = userEvent.setup();
    const onChangeSpy = jest.fn();
    await render(withProviders(<StatefulForm onChangeSpy={onChangeSpy} />));

    await user.press(screen.getByLabelText('Mañana'));

    expect(onChangeSpy).toHaveBeenCalledWith(expect.objectContaining({ startOffsetDays: 1 }));
  });
});
