-- 0001_accounts_and_pairing.sql
-- Cuentas (profiles sobre auth.users de Supabase) + vinculación
-- Cuidador <-> Adulto Mayor por código de invitación.

create extension if not exists pgcrypto;

-- =========================================================================
-- profiles
-- =========================================================================
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('ADULTO_MAYOR', 'CUIDADOR')),
  display_name text,
  invite_code text unique, -- solo se completa para ADULTO_MAYOR, ver trigger abajo
  created_at timestamptz not null default now()
);

-- Genera un código corto (6 caracteres, sin O/0/I/1 para evitar confusión
-- al dictarlo/leerlo) únicamente para cuentas de Adulto Mayor, reintentando
-- si por casualidad choca con uno ya existente.
create or replace function generate_invite_code()
returns text
language plpgsql
as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
  already_taken boolean;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    end loop;
    select exists(select 1 from profiles where invite_code = code) into already_taken;
    exit when not already_taken;
  end loop;
  return code;
end;
$$;

create or replace function set_invite_code()
returns trigger
language plpgsql
as $$
begin
  if new.role = 'ADULTO_MAYOR' and new.invite_code is null then
    new.invite_code := generate_invite_code();
  end if;
  return new;
end;
$$;

create trigger trg_set_invite_code
  before insert on profiles
  for each row execute function set_invite_code();

-- =========================================================================
-- caregiver_patient_links
-- =========================================================================
create table caregiver_patient_links (
  id uuid primary key default gen_random_uuid(),
  caregiver_id uuid not null references profiles(id) on delete cascade,
  patient_id uuid not null references profiles(id) on delete cascade,
  linked_at timestamptz not null default now(),
  unique (caregiver_id, patient_id)
);

-- =========================================================================
-- RLS
-- =========================================================================
alter table profiles enable row level security;
alter table caregiver_patient_links enable row level security;

-- Un perfil es visible para sí mismo, o para el otro lado de un vínculo ya existente.
create policy "profiles_select_own_or_linked"
  on profiles for select
  using (
    id = auth.uid()
    or id in (select patient_id from caregiver_patient_links where caregiver_id = auth.uid())
    or id in (select caregiver_id from caregiver_patient_links where patient_id = auth.uid())
  );

create policy "profiles_insert_own"
  on profiles for insert
  with check (id = auth.uid());

create policy "profiles_update_own"
  on profiles for update
  using (id = auth.uid());

-- Solo lectura por los dos lados del vínculo. NO hay policy de insert/update/delete
-- a propósito: el único camino para crear un vínculo es la función
-- `redeem_invite_code` de abajo (security definer), nunca un insert directo del cliente.
create policy "links_select_own"
  on caregiver_patient_links for select
  using (caregiver_id = auth.uid() or patient_id = auth.uid());

-- =========================================================================
-- redeem_invite_code(p_invite_code) — llamada por el Cuidador para
-- vincularse a la cuenta del Adulto Mayor dueño de ese código.
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

  if not exists (select 1 from profiles where id = auth.uid() and role = 'CUIDADOR') then
    raise exception 'ONLY_CAREGIVERS_CAN_REDEEM';
  end if;

  select id into v_patient_id from profiles where invite_code = upper(trim(p_invite_code));
  if v_patient_id is null then
    raise exception 'INVITE_CODE_INVALID';
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

grant execute on function redeem_invite_code(text) to authenticated;
