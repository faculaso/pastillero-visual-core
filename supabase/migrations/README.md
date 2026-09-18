# Migraciones de Supabase

Se aplican **a mano**, en orden, desde el SQL Editor del proyecto. No hay
runner automático: cada archivo se pega y se ejecuta.

## Regla: toda migración termina recargando la caché de PostgREST

```sql
notify pgrst, 'reload schema';
```

PostgREST cachea el esquema. Una tabla, vista, columna o función recién
creada existe en Postgres pero **la API REST no la ve** hasta que se le
avisa, y hasta entonces toda consulta contra ella vuelve con:

```
PGRST205: Could not find the table 'public.<tabla>' in the schema cache
```

Desde el cliente eso llega como un `REPOSITORY_FAILURE` cualquiera, así que
la pantalla muestra su estado de error genérico y **parece un bug de la app**.
Pasó con `0011_codigos_de_vinculacion.sql`: la migración estaba aplicada, la
tabla estaba creada, y "Mis cuidadores" igual no cargaba.

Es no disruptivo: no reinicia la base ni el servicio.

## Verificar qué está aplicado

Consulta de solo lectura:

```sql
select
  exists (select 1 from information_schema.columns
           where table_name = 'profiles' and column_name = 'is_patient') as tiene_0010,
  exists (select 1 from information_schema.tables
           where table_name = 'patient_invite_codes')                    as tiene_0011;
```

No se puede verificar desde afuera con la anon key: el rol `anon` no tiene
permisos sobre `profiles`, así que PostgREST no expone nada en su esquema y
una respuesta vacía no prueba ni que esté ni que no esté.

## Numeración

El `0006` no existe en el repo a propósito: hay un
`0006_reschedule_and_cancel_treatment.sql` que vivió fuera del control de
versiones y puede estar aplicado en la base real. No reutilizar ese número.
