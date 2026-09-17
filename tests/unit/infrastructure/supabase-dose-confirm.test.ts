import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseDoseRepository } from '../../../src/infrastructure/persistence/supabase/repositories/supabase-dose.repository';
import { MeasurementUnit } from '../../../src/domain';

const DOSE_ROW = {
  id: 'd1',
  treatment_id: 't1',
  scheduled_at: '2026-09-17T11:00:00.000Z',
  status: 'TAKEN',
  confirmed_at: '2026-09-17T11:05:00.000Z',
  quantity_taken_amount: 1,
  quantity_taken_unit: 'UNIT',
};

const STOCK_ROW = {
  stock_current_quantity: 0,
  stock_daily_consumption: 1,
  stock_unit: 'UNIT',
  stock_critical_threshold_days: 3,
};

function clientQueDevuelve(data: unknown, error: { message: string } | null = null): SupabaseClient {
  return { rpc: async () => ({ data, error }) } as unknown as SupabaseClient;
}

const CANTIDAD = { amount: 1, unit: MeasurementUnit.UNIT };

/**
 * La migración 0007 cambia `confirm_dose_atomic` para que quedarse sin stock
 * no impida registrar la toma, y le agrega `stockShortfall` a la respuesta.
 * Entre que esto se mergea y que alguien corre la migración en la base real
 * hay una ventana donde conviven las dos versiones de la función: el cliente
 * tiene que portarse bien contra ambas.
 */
describe('SupabaseDoseRepository.confirmDoseWithStockDecrement — compatibilidad con la migración 0007', () => {
  it('con 0007 aplicada: un faltante se reporta como stockWasShort', async () => {
    const repo = new SupabaseDoseRepository(
      clientQueDevuelve({ dose: DOSE_ROW, stock: STOCK_ROW, stockShortfall: 2 }),
    );

    const result = await repo.confirmDoseWithStockDecrement('d1', new Date(), CANTIDAD);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.stockWasShort).toBe(true);
      expect(result.value.stock.currentQuantity).toBe(0);
    }
  });

  it('con 0007 aplicada y stock suficiente: shortfall cero no es faltante', async () => {
    const repo = new SupabaseDoseRepository(
      clientQueDevuelve({ dose: DOSE_ROW, stock: { ...STOCK_ROW, stock_current_quantity: 9 }, stockShortfall: 0 }),
    );

    const result = await repo.confirmDoseWithStockDecrement('d1', new Date(), CANTIDAD);

    expect(result.ok && result.value.stockWasShort).toBe(false);
  });

  it('SIN 0007: la respuesta no trae el campo y no se inventa un faltante', async () => {
    // La función vieja no deja pasar una toma sin stock, así que si llegó
    // acá con éxito es porque alcanzaba. Leer `undefined` como "faltó algo"
    // le mostraría al Adulto Mayor un aviso de stock agotado que es falso.
    const repo = new SupabaseDoseRepository(
      clientQueDevuelve({ dose: DOSE_ROW, stock: { ...STOCK_ROW, stock_current_quantity: 9 } }),
    );

    const result = await repo.confirmDoseWithStockDecrement('d1', new Date(), CANTIDAD);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.stockWasShort).toBe(false);
  });

  it('SIN 0007: el STOCK_INSUFFICIENT que todavía tira la función vieja se sigue traduciendo', async () => {
    const repo = new SupabaseDoseRepository(
      clientQueDevuelve(null, { message: 'STOCK_INSUFFICIENT' }),
    );

    const result = await repo.confirmDoseWithStockDecrement('d1', new Date(), CANTIDAD);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('STOCK_INSUFFICIENT');
  });
});
