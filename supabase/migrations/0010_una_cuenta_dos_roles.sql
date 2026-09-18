-- 0010_una_cuenta_dos_roles.sql
-- Un mismo mail puede ser Adulto Mayor Y Cuidador a la vez.
--
-- Hasta acá `profiles.role` era el único dato de rol, y era excluyente:
-- quien se registraba como Cuidador para asignarle tratamientos a su mamá
-- no tenía forma de usar su propio pastillero sin crear una segunda cuenta
-- con otro correo. En las primeras pruebas con familia eso fue lo primero
-- que apareció.
--
-- El rol pasa a ser una CAPACIDAD (dos booleanos, se pueden tener los dos),
-- no un valor excluyente. `role` NO se borra a propósito: el APK v1.0.0 que
-- ya está en los teléfonos de la familia lee esa columna para elegir su
-- pantalla de inicio, y dropearla lo dejaría sin arrancar. Queda como "el
-- rol con el que se creó la cuenta" y como respaldo para clientes viejos.

alter table profiles
  add column if not exists is_patient boolean not null default false,
  add column if not exists is_caregiver boolean not null default false;

-- Backfill. El `where` lo hace re-ejecutable sin pisar a alguien que ya
-- activó su segundo rol.
update profiles
   set is_patient   = (role = 'ADULTO_MAYOR'),
       is_caregiver = (role = 'CUIDADOR')
 where not is_patient and not is_caregiver;

alter table profiles drop constraint if exists profiles_al_menos_un_rol;
alter table profiles
  add constraint profiles_al_menos_un_rol check (is_patient or is_caregiver);

-- =========================================================================
-- El código de invitación ahora depende de `is_patient`, no de `role`.
-- =========================================================================
-- Además pasa a correr también en UPDATE: quien se registró como Cuidador y
-- después activa su rol de Adulto Mayor necesita que se le genere el código
-- en ese momento, no en el alta.
create or replace function set_invite_code()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.is_patient and new.invite_code is null then
    new.invite_code := generate_invite_code();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_invite_code on profiles;
create trigger trg_set_invite_code
  before insert or update on profiles
  for each row execute function set_invite_code();

-- Le genera el código a quien ya tenía `is_patient` desde el backfill de
-- arriba (el trigger recién existe ahora, y el UPDATE de backfill corrió
-- con la versión vieja).
update profiles set invite_code = generate_invite_code()
 where is_patient and invite_code is null;

-- =========================================================================
-- Alta de cuenta: el rol elegido en el registro prende su capacidad.
-- =========================================================================
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := coalesce(new.raw_user_meta_data->>'role', 'ADULTO_MAYOR');
begin
  insert into public.profiles (id, role, display_name, is_patient, is_caregiver)
  values (
    new.id,
    v_role,
    new.raw_user_meta_data->>'display_name',
    v_role = 'ADULTO_MAYOR',
    v_role = 'CUIDADOR'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function handle_new_user() from public, anon, authenticated;

-- =========================================================================
-- redeem_invite_code: capacidad en vez de rol, y no vincularse a uno mismo.
-- =========================================================================
create or replace function redeem_invite_code(p_invite_code text)
returns caregiver_patient_links
language plpgsql
security definer
set search_path = public
as $$
declare
  v_patient_id uuid;
  v_link caregiver_patient_links;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  if not exists (select 1 from profiles where id = auth.uid() and is_caregiver) then
    raise exception 'ONLY_CAREGIVERS_CAN_REDEEM';
  end if;

  select id into v_patient_id
    from profiles
   where invite_code = upper(trim(p_invite_code))
     and is_patient;

  if v_patient_id is null then
    raise exception 'INVITE_CODE_INVALID';
  end if;

  -- Nuevo acá: con los dos roles en la misma cuenta, el usuario ve su
  -- propio código de invitación Y puede redimir códigos. Un vínculo (X, X)
  -- no significa nada y rompería la lista de pacientes del cuidador.
  if v_patient_id = auth.uid() then
    raise exception 'CANNOT_LINK_TO_SELF';
  end if;

  insert into caregiver_patient_links (caregiver_id, patient_id)
  values (auth.uid(), v_patient_id)
  on conflict (caregiver_id, patient_id) do nothing
  returning * into v_link;

  if v_link.id is null then
    -- Ya estaba vinculado antes: se devuelve el vínculo existente en vez de fallar.
    select * into v_link from caregiver_patient_links
      where caregiver_id = auth.uid() and patient_id = v_patient_id;
  end if;

  return v_link;
end;
$$;

revoke execute on function redeem_invite_code(text) from public, anon;
grant execute on function redeem_invite_code(text) to authenticated;
