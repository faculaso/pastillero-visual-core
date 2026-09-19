-- 0012_el_alta_conserva_el_id.sql
-- `register_treatment_with_doses` vuelve a insertar el `id` que ya generó el
-- cliente, para el tratamiento y para cada dosis.
--
-- Esto ya estaba arreglado en 0003. La migración 0005, para sumar una sola
-- columna (`visual_secondary_color`), recreó la función partiendo del cuerpo
-- de 0002 en vez del de 0003 — y se llevó puestos los dos `id` de nuevo.
--
-- Qué se rompía mientras tanto: la app le pone el `id` al tratamiento ANTES
-- de guardarlo (es el mismo `IdGenerator` que usa la versión SQLite) y lo usa
-- para todo lo que sigue. Como Postgres generaba otro con `gen_random_uuid()`,
-- el alta guardaba bien pero después nada encontraba esa fila:
--
--   * Al terminar el alta, la pantalla de adherencia abre el tratamiento
--     recién creado y volvía "Tratamiento no encontrado". El Cuidador veía un
--     error rojo sobre un tratamiento que en realidad SÍ se había asignado, y
--     no tenía cómo saber cuál de las dos cosas era cierta.
--   * Las alarmas de las dosis nuevas se programan con el `id` de la dosis.
--     Con ids huérfanos, confirmar la toma desde la alarma apunta a una fila
--     que no existe.
--
-- `create or replace function` no toca ninguna tabla ni fila: los
-- tratamientos que ya se crearon con un id del servidor siguen igual y siguen
-- funcionando (sus dosis apuntan al id correcto, el del servidor). Lo único
-- que cambia es que de acá en adelante el id que guarda la base es el que la
-- app ya está usando.

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
    visual_shape, visual_color, visual_secondary_color, visual_pill_image_url, visual_box_image_url,
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
    p_treatment->>'visual_secondary_color',
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

-- Ver `supabase/migrations/README.md`: toda migración que cree o cambie
-- funciones termina recargando la caché de esquema de PostgREST.
notify pgrst, 'reload schema';
