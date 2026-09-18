-- 0011_codigos_de_vinculacion.sql
-- Un Adulto Mayor puede tener hasta 3 Cuidadores, cada uno con su PROPIO
-- código, y puede generar códigos nuevos o dar de baja los que no se usaron.
--
-- Hasta acá había un solo código por persona, en `profiles.invite_code`,
-- que no vencía nunca y no se podía dar de baja: quien lo escuchó una vez
-- podía vincularse para siempre. Y como era uno solo, tampoco había forma
-- de saber qué cuidador entró con qué código.

-- Tope de cuidadores por Adulto Mayor. Cuenta los vínculos YA hechos más
-- los códigos entregados y todavía sin usar: dar un cuarto código sabiendo
-- que va a fallar al redimirlo sería peor que no dejar generarlo.
create or replace function max_caregivers_per_patient()
returns int
language sql
immutable
set search_path = public
as $fn$ select 3 $fn$;

create table if not exists patient_invite_codes (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references profiles(id) on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now(),
  -- Un código se consume al usarse: queda atado al cuidador que lo redimió
  -- y ya no sirve para vincular a nadie más.
  redeemed_at timestamptz,
  redeemed_by uuid references profiles(id) on delete set null
);

create index if not exists idx_invite_codes_patient on patient_invite_codes(patient_id);

-- Los códigos que ya existían pasan a la tabla SIN marcar como usados: son
-- los que la gente ya tiene anotados y le dictó a su cuidador, y tienen que
-- seguir funcionando. Los vínculos que ya existen no se tocan.
insert into patient_invite_codes (patient_id, code)
select p.id, p.invite_code
  from profiles p
 where p.invite_code is not null
   and not exists (select 1 from patient_invite_codes c where c.code = p.invite_code);

-- =========================================================================
-- RLS: solo lectura, y solo de lo propio. Crear/borrar pasa por las RPC.
-- =========================================================================
alter table patient_invite_codes enable row level security;

drop policy if exists "invite_codes_select_own" on patient_invite_codes;
create policy "invite_codes_select_own"
  on patient_invite_codes for select
  using (patient_id = auth.uid() or redeemed_by = auth.uid());

-- =========================================================================
-- `profiles.invite_code` sigue existiendo para el APK v1.0.0 que ya está en
-- los teléfonos (lo lee para mostrarle el código al Adulto Mayor). Este
-- trigger lo espeja a la tabla nueva, así el generador sigue siendo uno solo.
-- =========================================================================
create or replace function mirror_invite_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if new.invite_code is not null then
    insert into patient_invite_codes (patient_id, code)
    values (new.id, new.invite_code)
    on conflict (code) do nothing;
  end if;
  return new;
end;
$fn$;

drop trigger if exists trg_mirror_invite_code on profiles;
create trigger trg_mirror_invite_code
  after insert or update of invite_code on profiles
  for each row execute function mirror_invite_code();

revoke execute on function mirror_invite_code() from public, anon, authenticated;

-- =========================================================================
-- set_invite_code: generar SOLO al crear la cuenta o al activar el rol.
-- =========================================================================
-- La versión de 0010 corría en cualquier UPDATE, y eso choca de frente con
-- poder dar de baja un código: `revoke_invite_code` y `unlink_caregiver`
-- ponen `profiles.invite_code` en null, y el trigger le generaba uno nuevo
-- en el mismo statement. La baja parecía no hacer nada y aparecía un código
-- que nadie pidió.
create or replace function set_invite_code()
returns trigger
language plpgsql
set search_path = public
as $fn$
begin
  if not new.is_patient or new.invite_code is not null then
    return new;
  end if;

  -- Al insertar siempre; al actualizar, solo cuando el rol de Adulto Mayor
  -- se está prendiendo recién ahora.
  if tg_op = 'INSERT' or not old.is_patient then
    new.invite_code := generate_invite_code();
  end if;

  return new;
end;
$fn$;

-- =========================================================================
-- create_invite_code() — un código nuevo para el Adulto Mayor autenticado.
-- =========================================================================
create or replace function create_invite_code()
returns patient_invite_codes
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_ocupados int;
  v_row patient_invite_codes;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  if not exists (select 1 from profiles where id = auth.uid() and is_patient) then
    raise exception 'ONLY_PATIENTS_HAVE_CODES';
  end if;

  select
    (select count(*) from caregiver_patient_links where patient_id = auth.uid())
  + (select count(*) from patient_invite_codes where patient_id = auth.uid() and redeemed_at is null)
  into v_ocupados;

  if v_ocupados >= max_caregivers_per_patient() then
    raise exception 'INVITE_CODE_LIMIT_REACHED';
  end if;

  insert into patient_invite_codes (patient_id, code)
  values (auth.uid(), generate_invite_code())
  returning * into v_row;

  return v_row;
end;
$fn$;

revoke execute on function create_invite_code() from public, anon;
grant execute on function create_invite_code() to authenticated;

-- =========================================================================
-- revoke_invite_code(p_code_id) — dar de baja un código todavía sin usar.
-- =========================================================================
-- Solo los no usados: borrar uno ya redimido no desvincularía a nadie (para
-- eso está `unlink_caregiver`) y daría la falsa sensación de haberlo hecho.
create or replace function revoke_invite_code(p_code_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_borrados int;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  delete from patient_invite_codes
   where id = p_code_id
     and patient_id = auth.uid()
     and redeemed_at is null;

  get diagnostics v_borrados = row_count;
  if v_borrados = 0 then
    raise exception 'INVITE_CODE_NOT_REVOCABLE';
  end if;

  -- Si el que se dio de baja era el código espejado en `profiles`, hay que
  -- limpiarlo también, o el APK viejo seguiría mostrando uno que ya no sirve.
  update profiles set invite_code = null
   where id = auth.uid()
     and invite_code not in (select code from patient_invite_codes where patient_id = auth.uid());
end;
$fn$;

revoke execute on function revoke_invite_code(uuid) from public, anon;
grant execute on function revoke_invite_code(uuid) to authenticated;

-- =========================================================================
-- unlink_caregiver(p_caregiver_id) — sacarle el acceso a un cuidador.
-- =========================================================================
-- Sin esto, el tope de 3 sería una puerta de una sola dirección: al tercer
-- cuidador vinculado no habría forma de liberar un lugar nunca más.
create or replace function unlink_caregiver(p_caregiver_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_borrados int;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  delete from caregiver_patient_links
   where patient_id = auth.uid()
     and caregiver_id = p_caregiver_id;

  get diagnostics v_borrados = row_count;
  if v_borrados = 0 then
    raise exception 'CAREGIVER_NOT_LINKED';
  end if;

  -- El código que usó se borra con él: ya lo escuchó una vez, y dejarlo vivo
  -- le permitiría volver a entrar solo con lo que ya sabe.
  delete from patient_invite_codes
   where patient_id = auth.uid()
     and redeemed_by = p_caregiver_id;

  update profiles set invite_code = null
   where id = auth.uid()
     and invite_code not in (select code from patient_invite_codes where patient_id = auth.uid());
end;
$fn$;

revoke execute on function unlink_caregiver(uuid) from public, anon;
grant execute on function unlink_caregiver(uuid) to authenticated;

-- =========================================================================
-- redeem_invite_code: códigos de la tabla nueva, de un solo uso, con tope.
-- =========================================================================
create or replace function redeem_invite_code(p_invite_code text)
returns caregiver_patient_links
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_code patient_invite_codes;
  v_link caregiver_patient_links;
  v_cuidadores int;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  if not exists (select 1 from profiles where id = auth.uid() and is_caregiver) then
    raise exception 'ONLY_CAREGIVERS_CAN_REDEEM';
  end if;

  select * into v_code
    from patient_invite_codes
   where code = upper(trim(p_invite_code));

  if v_code.id is null then
    raise exception 'INVITE_CODE_INVALID';
  end if;

  if v_code.patient_id = auth.uid() then
    raise exception 'CANNOT_LINK_TO_SELF';
  end if;

  -- Ya vinculado con esta misma persona: se devuelve el vínculo existente en
  -- vez de fallar (mismo criterio que antes), sin consumir otro código.
  select * into v_link from caregiver_patient_links
   where caregiver_id = auth.uid() and patient_id = v_code.patient_id;
  if v_link.id is not null then
    return v_link;
  end if;

  -- Un código es de un solo uso: si ya lo usó otro, no sirve más.
  if v_code.redeemed_at is not null then
    raise exception 'INVITE_CODE_ALREADY_USED';
  end if;

  select count(*) into v_cuidadores
    from caregiver_patient_links where patient_id = v_code.patient_id;

  if v_cuidadores >= max_caregivers_per_patient() then
    raise exception 'TOO_MANY_CAREGIVERS';
  end if;

  insert into caregiver_patient_links (caregiver_id, patient_id)
  values (auth.uid(), v_code.patient_id)
  returning * into v_link;

  update patient_invite_codes
     set redeemed_at = now(), redeemed_by = auth.uid()
   where id = v_code.id;

  return v_link;
end;
$fn$;

revoke execute on function redeem_invite_code(text) from public, anon;
grant execute on function redeem_invite_code(text) to authenticated;

-- =========================================================================
-- Recargar la caché de esquema de PostgREST.
-- =========================================================================
-- Sin esto la tabla existe en Postgres pero la API REST no la ve, y toda
-- consulta a `patient_invite_codes` vuelve con
-- `PGRST205: Could not find the table 'public.patient_invite_codes' in the
-- schema cache`. Pasó de verdad al aplicar esta migración: la pantalla "Mis
-- cuidadores" mostraba su estado de error y parecía un bug del cliente.
--
-- Va al final de toda migración que cree o cambie tablas, vistas o
-- funciones. Es no disruptivo: no reinicia la base ni el servicio.
notify pgrst, 'reload schema';
