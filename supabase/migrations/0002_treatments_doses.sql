-- 0002_treatments_doses.sql
-- Tratamientos y dosis. Mismas columnas que la migración SQLite local
-- (001_initial_schema.sql), salvo `medication_catalog_id`/`medication_name`:
-- el catálogo ANMAT (~16.000 medicamentos) NO se migra a Supabase — sigue
-- viviendo solo en SQLite local en cada dispositivo — así que acá se
-- guarda un snapshot desnormalizado (id + nombre) en vez de un FK real.

-- =========================================================================
-- treatments
-- =========================================================================
create table treatments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references profiles(id) on delete cascade,
  caregiver_id uuid not null references profiles(id) on delete cascade,

  medication_catalog_id text not null,
  medication_name text not null,

  status text not null default 'ACTIVE'
    check (status in ('ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED')),

  visual_shape text not null
    check (visual_shape in ('ROUND', 'OVAL', 'CAPSULE', 'RECTANGULAR', 'TRIANGULAR', 'OTHER')),
  visual_color text not null,
  visual_pill_image_url text,
  visual_box_image_url text,
  visual_model3d_url text,
  visual_slot_label text,

  dosage_frequency text not null
    check (dosage_frequency in ('DAILY', 'SPECIFIC_WEEKDAYS', 'CUSTOM_INTERVAL_DAYS', 'AS_NEEDED')),
  dosage_times_of_day jsonb not null default '[]'::jsonb, -- [{hour,minute}, ...]
  dosage_amount numeric not null check (dosage_amount > 0),
  dosage_unit text not null check (dosage_unit in ('MG', 'MCG', 'G', 'ML', 'UI', 'UNIT')),
  dosage_start_date date not null,
  dosage_end_date date,
  dosage_interval_days int,
  dosage_weekdays jsonb, -- [0..6], 0=domingo

  stock_current_quantity numeric not null check (stock_current_quantity >= 0),
  stock_daily_consumption numeric not null check (stock_daily_consumption >= 0),
  stock_unit text not null check (stock_unit in ('MG', 'MCG', 'G', 'ML', 'UI', 'UNIT')),
  stock_critical_threshold_days int not null default 3,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_treatments_patient_status on treatments(patient_id, status);
create index idx_treatments_caregiver on treatments(caregiver_id);

create or replace function touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_treatments_touch_updated_at
  before update on treatments
  for each row execute function touch_updated_at();

-- =========================================================================
-- doses
-- =========================================================================
create table doses (
  id uuid primary key default gen_random_uuid(),
  treatment_id uuid not null references treatments(id) on delete cascade,
  scheduled_at timestamptz not null,
  status text not null default 'PENDING'
    check (status in ('PENDING', 'TAKEN', 'MISSED', 'SKIPPED')),
  confirmed_at timestamptz,
  quantity_taken_amount numeric,
  quantity_taken_unit text check (quantity_taken_unit in ('MG', 'MCG', 'G', 'ML', 'UI', 'UNIT'))
);

create index idx_doses_treatment_scheduled on doses(treatment_id, scheduled_at);
create index idx_doses_status_scheduled on doses(status, scheduled_at);

-- Vista usada por el repositorio de dosis para consultas por paciente
-- (la tabla `doses` no tiene patient_id/caregiver_id directo).
-- `security_invoker` es necesario para que la vista respete la RLS del
-- usuario que consulta, no la del dueño de la vista.
create view doses_with_patient
  with (security_invoker = true) as
select d.*, t.patient_id, t.caregiver_id, t.medication_name
from doses d
join treatments t on t.id = d.treatment_id;

-- =========================================================================
-- RLS
-- =========================================================================
alter table treatments enable row level security;
alter table doses enable row level security;

create policy "treatments_select"
  on treatments for select
  using (patient_id = auth.uid() or caregiver_id = auth.uid());

create policy "treatments_update"
  on treatments for update
  using (patient_id = auth.uid() or caregiver_id = auth.uid());

create policy "treatments_insert_caregiver"
  on treatments for insert
  with check (caregiver_id = auth.uid());

create policy "treatments_delete_caregiver"
  on treatments for delete
  using (caregiver_id = auth.uid());

create policy "doses_select"
  on doses for select
  using (
    exists (
      select 1 from treatments t
      where t.id = doses.treatment_id
        and (t.patient_id = auth.uid() or t.caregiver_id = auth.uid())
    )
  );

-- Solo el paciente confirma/modifica sus propias dosis (misma regla que ya
-- aplicaba `ConfirmDoseUseCase` del lado del cliente: acá queda reforzada
-- también del lado del servidor).
create policy "doses_update_patient"
  on doses for update
  using (
    exists (
      select 1 from treatments t
      where t.id = doses.treatment_id and t.patient_id = auth.uid()
    )
  );

create policy "doses_insert_caregiver"
  on doses for insert
  with check (
    exists (
      select 1 from treatments t
      where t.id = doses.treatment_id and t.caregiver_id = auth.uid()
    )
  );

-- =========================================================================
-- register_treatment_with_doses(p_treatment, p_doses)
-- Crea el tratamiento + sus dosis iniciales en un solo statement
-- transaccional — reemplaza al `TransactionRunner` de SQLite, que no es
-- portable a Postgres/PostgREST (sin conexión persistente compartida entre
-- llamadas HTTP).
-- =========================================================================
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
    visual_shape, visual_color, visual_pill_image_url, visual_box_image_url,
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

-- =========================================================================
-- confirm_dose_atomic(...)
-- Confirma la dosis + descuenta stock en un solo statement transaccional.
-- Los dos guards condicionales (`status='PENDING'`,
-- `stock_current_quantity >= cantidad`) son los mismos que ya existían por
-- separado en SqliteDoseRepository.confirmDose / SqliteStockRepository.decrement.
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
begin
  update doses
    set status = 'TAKEN',
        confirmed_at = p_confirmed_at,
        quantity_taken_amount = p_quantity,
        quantity_taken_unit = p_quantity_unit
    where id = p_dose_id and status = 'PENDING'
    returning * into v_dose;

  if not found then
    raise exception 'DOSE_ALREADY_CONFIRMED_OR_NOT_FOUND';
  end if;

  update treatments
    set stock_current_quantity = stock_current_quantity - p_quantity
    where id = v_dose.treatment_id and stock_current_quantity >= p_quantity
    returning * into v_treatment;

  if not found then
    raise exception 'STOCK_INSUFFICIENT';
  end if;

  return jsonb_build_object('dose', to_jsonb(v_dose), 'stock', to_jsonb(v_treatment));
end;
$$;

grant execute on function confirm_dose_atomic(uuid, timestamptz, numeric, text) to authenticated;
