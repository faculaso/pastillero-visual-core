-- 0005_capsule_bicolor_shape.sql
-- Suma la forma de pastilla "cápsula bicolor" (RF-02) — mismo cambio que
-- `003_capsule_bicolor_shape.sql` del lado de SQLite local, pero en Postgres
-- alterar un CHECK constraint es directo (drop + add), sin necesidad de
-- recrear la tabla como en SQLite.

alter table treatments add column visual_secondary_color text;

alter table treatments drop constraint treatments_visual_shape_check;
alter table treatments add constraint treatments_visual_shape_check
  check (visual_shape in ('ROUND', 'OVAL', 'CAPSULE', 'CAPSULE_BICOLOR', 'RECTANGULAR', 'TRIANGULAR', 'OTHER'));

-- Reemplaza `register_treatment_with_doses` (0002_treatments_doses.sql) para
-- sumar `visual_secondary_color` al insert — el resto de la función queda
-- idéntico.
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
    patient_id, caregiver_id, medication_catalog_id, medication_name, status,
    visual_shape, visual_color, visual_secondary_color, visual_pill_image_url, visual_box_image_url,
    visual_model3d_url, visual_slot_label,
    dosage_frequency, dosage_times_of_day, dosage_amount, dosage_unit,
    dosage_start_date, dosage_end_date, dosage_interval_days, dosage_weekdays,
    stock_current_quantity, stock_daily_consumption, stock_unit, stock_critical_threshold_days
  )
  values (
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

  insert into doses (treatment_id, scheduled_at)
  select v_treatment.id, (d->>'scheduled_at')::timestamptz
  from jsonb_array_elements(p_doses) d;

  get diagnostics v_dose_count = row_count;

  return jsonb_build_object('treatment', to_jsonb(v_treatment), 'doseCount', v_dose_count);
end;
$$;

grant execute on function register_treatment_with_doses(jsonb, jsonb) to authenticated;
