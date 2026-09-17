-- =========================================================================
-- Hallazgos del linter de Supabase (informe del 2026-09-17).
--
-- Dos cosas distintas, las dos baratas:
--
-- 1. `search_path` mutable en tres funciones. Ninguna de las tres es
--    `security definer`, así que NO hay escalada de privilegios posible
--    (el ataque clásico necesita que la función corra como su dueño y no
--    como quien la llama). Aun así se fija el `search_path`: cuesta una
--    línea y saca del medio toda una clase de sorpresas, además de dejar a
--    estas tres consistentes con `redeem_invite_code` y `handle_new_user`,
--    que ya lo tenían.
--
-- 2. Funciones `security definer` ejecutables por `anon`. Postgres le da
--    EXECUTE a PUBLIC a toda función nueva, y `anon` hereda de PUBLIC — por
--    eso aparecen expuestas aunque la migración original solo le hubiera
--    dado el grant explícito a `authenticated`.
--
-- Sobre revocar EXECUTE a funciones de trigger: es seguro. La
-- documentación de Postgres es explícita en que el privilegio EXECUTE
-- sobre la función de un trigger se exige al CREAR el trigger, no cada vez
-- que dispara ("To create or replace a trigger, a user must have the
-- TRIGGER privilege on the table and the EXECUTE privilege on the trigger
-- function"). Revocarlo no afecta al alta de usuarios.
--
-- Lo que este archivo NO toca: `rls_auto_enable()`, que el linter también
-- marca como `security definer` ejecutable por `anon`. Esa función NO
-- existe en ninguna migración de este repo (igual que la 0006 que falta).
-- No se toca a ciegas algo cuyo código no se puede leer.
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1. search_path fijo
-- -------------------------------------------------------------------------

create or replace function generate_invite_code()
returns text
language plpgsql
set search_path = public
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
set search_path = public
as $$
begin
  if new.role = 'ADULTO_MAYOR' and new.invite_code is null then
    new.invite_code := generate_invite_code();
  end if;
  return new;
end;
$$;

create or replace function touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -------------------------------------------------------------------------
-- 2. Quitar de la API pública lo que no tiene por qué estar
-- -------------------------------------------------------------------------

-- Función de trigger sobre `auth.users`. Llamarla por RPC no tendría
-- sentido (Postgres rechaza invocar una función de trigger fuera de un
-- trigger), pero no hay ninguna razón para que figure en la API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- El Cuidador SÍ la llama para vincularse con su paciente: `authenticated`
-- se conserva a propósito. `anon` no: la función corta con NOT_AUTHENTICATED
-- apenas ve `auth.uid()` en null, así que tampoco era explotable, pero no
-- tiene por qué estar publicada.
revoke execute on function public.redeem_invite_code(text) from public, anon;
grant execute on function public.redeem_invite_code(text) to authenticated;

-- `generate_invite_code`, `set_invite_code` y `touch_updated_at` conservan
-- sus grants a propósito: el linter no las marcó por ejecutables (no son
-- `security definer`) y `set_invite_code` llama a `generate_invite_code`
-- como INVOKER, así que revocarle EXECUTE podría romper un alta de perfil
-- por un camino que no se ve desde acá. No se arregla lo que no está roto.
