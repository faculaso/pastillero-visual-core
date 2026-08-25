-- 0003_fix_rpc_ids_and_errors.sql
-- Parche sobre las dos funciones de 0002_treatments_doses.sql. Seguro de
-- correr sobre una base que ya tiene 0002 aplicada: `create or replace
-- function` no toca ninguna tabla ni fila existente.
--
-- Qué cambia:
--  1. `register_treatment_with_doses` ahora usa el `id` que ya vino generado
--     del cliente (mismo `IdGenerator` que usa la versión SQLite) en vez de
--     dejar que Postgres genere uno propio con `gen_random_uuid()` — si no,
--     el id que la app ya usó para vincular las dosis al tratamiento (antes
--     de siquiera llamar a esta función) quedaría huérfano.
--  2. `confirm_dose_atomic` distingue "no existe" de "ya estaba confirmada"
--     y de "tratamiento no encontrado" (antes los primeros dos quedaban
--     mezclados en un solo mensaje de error).

create or replace function register_treatment_with_doses(p_treatment jsonb, p_doses jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_treatment treatments;
  v_dose_count int;
begin
  insert into treatments (
    id, patient_id, caregiver_id, medication_catalog_id, medication_name, status,
    visual_shape, visual_color, visual_pill_image_url, visual_box_image_url,
    visual_model3d_url, visual_slot_label,
    dosage_frequency, dosage_times_of_day, dosage_amount, dosage_unit,
    dosage_start_date, dosage_end_date, dosage_interval_days, dosage_weekdays,
    stock_current_quantity, stock_daily_consumption, stock_unit, stock_critical_threshold_days
  )
  values (
    (p_treatment->>'id')::uuid,
    (p_treatment->>'patient_id')::uuid,
    (p_treatment->>'caregiver_id')::uuid,
    p_treatment->>'medication_catalog_id',
    p_treatment->>'medication_name',
    coalesce(p_treatment->>'status', 'ACTIVE'),
    p_treatment->>'visual_shape',
    p_treatment->>'visual_color',
    p_treatment->>'visual_pill_image_url',
    p_treatment->>'visual_box_image_url',
    p_treatment->>'visual_model3d_url',
    p_treatment->>'visual_slot_label',
    p_treatment->>'dosage_frequency',
    coalesce(p_treatment->'dosage_times_of_day', '[]'::jsonb),
    (p_treatment->>'dosage_amount')::numeric,
    p_treatment->>'dosage_unit',
    (p_treatment->>'dosage_start_date')::date,
    nullif(p_treatment->>'dosage_end_date', '')::date,
    nullif(p_treatment->>'dosage_interval_days', '')::int,
    p_treatment->'dosage_weekdays',
    (p_treatment->>'stock_current_quantity')::numeric,
    (p_treatment->>'stock_daily_consumption')::numeric,
    p_treatment->>'stock_unit',
    coalesce((p_treatment->>'stock_critical_threshold_days')::int, 3)
  )
  returning * into v_treatment;

  insert into doses (id, treatment_id, scheduled_at)
  select (d->>'id')::uuid, v_treatment.id, (d->>'scheduled_at')::timestamptz
  from jsonb_array_elements(p_doses) d;

  get diagnostics v_dose_count = row_count;

  return jsonb_build_object('treatment', to_jsonb(v_treatment), 'doseCount', v_dose_count);
end;
$$;

grant execute on function register_treatment_with_doses(jsonb, jsonb) to authenticated;

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
begin
  select * into v_dose from doses where id = p_dose_id;
  if v_dose.id is null then
    raise exception 'DOSE_NOT_FOUND';
  end if;
  if v_dose.status <> 'PENDING' then
    raise exception 'DOSE_ALREADY_CONFIRMED';
  end if;

  update doses
    set status = 'TAKEN',
        confirmed_at = p_confirmed_at,
        quantity_taken_amount = p_quantity,
        quantity_taken_unit = p_quantity_unit
    where id = p_dose_id
    returning * into v_dose;

  select * into v_treatment from treatments where id = v_dose.treatment_id;
  if v_treatment.id is null then
    raise exception 'TREATMENT_NOT_FOUND';
  end if;
  if v_treatment.stock_current_quantity < p_quantity then
    raise exception 'STOCK_INSUFFICIENT';
  end if;

  update treatments
    set stock_current_quantity = stock_current_quantity - p_quantity
    where id = v_dose.treatment_id
    returning * into v_treatment;

  return jsonb_build_object('dose', to_jsonb(v_dose), 'stock', to_jsonb(v_treatment));
end;
$$;

grant execute on function confirm_dose_atomic(uuid, timestamptz, numeric, text) to authenticated;
