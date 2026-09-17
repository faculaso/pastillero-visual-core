-- =========================================================================
-- Quedarse sin stock ya no impide registrar una toma.
--
-- Hasta acá `confirm_dose_atomic` hacía `raise exception 'STOCK_INSUFFICIENT'`
-- cuando la cantidad registrada no alcanzaba. Como todo el cuerpo corre en
-- una transacción, esa excepción también revertía el UPDATE de la dosis: la
-- toma NO quedaba registrada.
--
-- El problema es de quién mantiene cada dato. El stock lo carga el Cuidador
-- a mano y es una ESTIMACIÓN; que el Adulto Mayor haya tomado la pastilla es
-- un HECHO. Con la regla vieja, un olvido de inventario del Cuidador
-- convertía una toma real en un registro de incumplimiento, y encima el
-- Adulto Mayor veía un error frente a una pastilla que ya se había tomado.
-- La adherencia — que es justamente lo que esta app existe para medir —
-- terminaba mintiendo por culpa de un número administrativo.
--
-- Ahora el stock se descuenta hasta cero y nunca por debajo, y la función
-- devuelve `stockShortfall`: cuánto faltó. Un valor > 0 no es un error, es
-- la señal de que el inventario del Cuidador está desactualizado.
--
-- NOTA SOBRE LA NUMERACIÓN: se salta el 0006 a propósito. Existe un
-- `0006_reschedule_and_cancel_treatment.sql` fuera de este repo que puede
-- estar aplicado en la base real; reusar ese número haría que el runner
-- diera esta migración por aplicada y nunca la corriera.
-- =========================================================================

create or replace function confirm_dose_atomic(
  p_dose_id uuid,
  p_confirmed_at timestamptz,
  p_quantity numeric,
  p_quantity_unit text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_dose doses;
  v_treatment treatments;
  v_shortfall numeric;
begin
  select * into v_dose from doses where id = p_dose_id;
  if v_dose.id is null then
    raise exception 'DOSE_NOT_FOUND';
  end if;
  if v_dose.status <> 'PENDING' then
    raise exception 'DOSE_ALREADY_CONFIRMED';
  end if;

  select * into v_treatment from treatments where id = v_dose.treatment_id;
  if v_treatment.id is null then
    raise exception 'TREATMENT_NOT_FOUND';
  end if;

  update doses
    set status = 'TAKEN',
        confirmed_at = p_confirmed_at,
        quantity_taken_amount = p_quantity,
        quantity_taken_unit = p_quantity_unit
    where id = p_dose_id
    returning * into v_dose;

  -- Cuánto faltaba para cubrir la toma. Cero si alcanzaba.
  v_shortfall := greatest(p_quantity - v_treatment.stock_current_quantity, 0);

  update treatments
    set stock_current_quantity = greatest(stock_current_quantity - p_quantity, 0)
    where id = v_dose.treatment_id
    returning * into v_treatment;

  return jsonb_build_object(
    'dose', to_jsonb(v_dose),
    'stock', to_jsonb(v_treatment),
    'stockShortfall', v_shortfall
  );
end;
$$;

grant execute on function confirm_dose_atomic(uuid, timestamptz, numeric, text) to authenticated;
