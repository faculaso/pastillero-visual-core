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

## Regla: `create or replace function` parte de la ÚLTIMA versión, no de la original

Recrear una función copiando el cuerpo de la migración que la **creó** pisa
en silencio todos los arreglos que vinieron después. Nada falla al aplicarla:
la función se reemplaza sin error y el bug vuelve intacto.

Pasó de verdad. `0003_fix_rpc_ids_and_errors.sql` arregló
`register_treatment_with_doses` para que usara el `id` que genera el cliente.
`0005_capsule_bicolor_shape.sql` la recreó para sumarle **una sola columna**,
partiendo del cuerpo de `0002` — y se llevó puesto ese arreglo de nuevo.
Resultado: el alta guardaba bien pero devolvía un id que no existía, y el
Cuidador veía "no se pudo" sobre un tratamiento que sí se había asignado.
Ver `0012_el_alta_conserva_el_id.sql`.

Antes de pegar un `create or replace function`, buscar quién más la tocó:

```bash
grep -rln "nombre_de_la_funcion" supabase/migrations/
```

Si aparece en más de un archivo, el cuerpo del que hay que copiar es el del
número **más alto**, no el del primero.
