-- 0004_auto_create_profile_trigger.sql
-- Crea automáticamente la fila de `profiles` cuando se registra un usuario
-- nuevo en `auth.users` — el cliente YA NO hace `insert into profiles`
-- después de `signUp()`, porque si el proyecto exige confirmación de
-- email, en ese momento todavía no hay sesión activa (`auth.uid()` es
-- null), y la policy `profiles_insert_own` de 0001 lo rechazaría.
--
-- `role`/`display_name` viajan como metadata del propio `signUp()`
-- (`options.data`), que SÍ está disponible en `raw_user_meta_data` desde
-- el momento en que se crea la fila en `auth.users`, sin depender de RLS
-- (el trigger corre `security definer`).

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'ADULTO_MAYOR'),
    new.raw_user_meta_data->>'display_name'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_handle_new_user on auth.users;
create trigger trg_handle_new_user
  after insert on auth.users
  for each row execute function handle_new_user();
