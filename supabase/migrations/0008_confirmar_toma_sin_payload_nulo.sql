-- =========================================================================
-- `confirm_dose_atomic` no puede devolver un éxito con la toma en null.
--
-- La migración 0007 movió la búsqueda del tratamiento ANTES del UPDATE de
-- la dosis (para poder calcular el faltante de stock). Sin querer, eso sacó
-- del medio la única comprobación que había de que el UPDATE hubiera tocado
-- alguna fila: en la versión previa, si no tocaba ninguna, `v_dose` quedaba
-- en null y el `select ... where id = v_dose.treatment_id` de después no
-- encontraba nada, lo que hacía saltar TREATMENT_NOT_FOUND y abortaba todo.
--
-- Con 0007 ese freno accidental ya no está: si el UPDATE no toca ninguna
-- fila, la función sigue de largo y devuelve
-- `{dose: null, stock: null, stockShortfall: N}` con éxito. El stock NO se
-- descuenta (el `where id = null` no matchea), así que no se corrompe nada,
-- pero el cliente recibe un payload que no puede mapear.
--
-- Cuándo pasa de verdad, que es lo que lo hace importante: la pantalla del
-- pastillero y el handler de la notificación pueden confirmar LA MISMA toma
-- casi al mismo tiempo. El segundo encuentra la fila ya en TAKEN entre su
-- SELECT y su UPDATE, y hasta acá recibía un DOSE_ALREADY_CONFIRMED
-- prolijo. Ahora recibiría el payload nulo.
--
-- El otro caso es la política RLS `doses_update_patient`: el Cuidador PUEDE
-- ver la toma (`doses_select`) pero no confirmarla. Se distingue de la
-- carrera mirando si la fila sigue PENDING.
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
      and status = 'PENDING'
    returning * into v_dose;

  -- El freno que 0007 había perdido. Va ANTES de tocar el stock: descontar
  -- por una toma que no se registró sería exactamente el bug que 0007 vino
  -- a arreglar, pero al revés.
  if v_dose.id is null then
    if exists (select 1 from doses where id = p_dose_id and status = 'PENDING') then
      -- Sigue PENDING y aun así no se pudo actualizar: lo frenó
      -- `doses_update_patient`, que solo deja confirmar al propio paciente.
      raise exception 'UNAUTHORIZED_ACTOR';
    end if;
    -- Dejó de estar PENDING entre el SELECT y el UPDATE: alguien la confirmó primero.
    raise exception 'DOSE_ALREADY_CONFIRMED';
  end if;

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
