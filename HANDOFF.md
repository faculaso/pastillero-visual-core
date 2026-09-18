# Handoff — Pastillero Visual Core

Estado de trabajo para retomar en otra sesión. **No** es documentación del
proyecto (eso está en `README.md`): es qué quedó hecho, qué quedó abierto y
las trampas de entorno ya resueltas, para no volver a perder tiempo en ellas.

Última actualización: **17 de septiembre de 2026**.

---

## Estado del repo

Repo `faculaso/pastillero-visual-core` (privado). Rama por defecto: **`master`**.

| PR | Estado | Qué |
| --- | --- | --- |
| #1 | mergeado | Recuperar contraseña en el login |
| #2 | mergeado | Rediseño de la pantalla de toma + pipeline del catálogo ANMAT |
| #3 | mergeado | Sitio público (`web/`) |
| #4 | mergeado | No mostrar tomas de tratamientos dados de baja |
| #5 | mergeado | Tablero del Cuidador: adherencia con nivel, no siempre verde |
| #6 | mergeado | Alta: cuándo empieza y por cuánto tiempo |
| #7 | mergeado | Horizonte rodante de dosis |
| #8 | mergeado | Respaldo offline de lecturas |
| #9 | mergeado | Pausar / reanudar / dar de baja un tratamiento |
| #10 | mergeado, pero **NO llegó a `master`** | ver abajo |
| #11 | mergeado | Reenvío del #10, esta vez contra `master` |
| #12 | mergeado + **migración 0007 aplicada** | Quedarse sin stock ya no impide registrar una toma |
| #13 | mergeado + migración 0008 | Arregla el payload nulo que introdujo la 0007 |

**No hay PRs abiertas.** Verificación en `master`: **typecheck limpio, 327
Vitest, 142 Jest.**

### Migraciones de Supabase: estado real

`supabase/migrations/` va **0001-0005, 0007, 0008**. El 0006 se saltea a
propósito (ver decisión abierta más abajo). Las migraciones se aplican a mano,
pegando el archivo en el SQL Editor del dashboard — no hay CLI configurado.

Para saber qué tiene la base de verdad, esta consulta es de solo lectura:

```sql
select prosrc like '%stockShortfall%' as tiene_0007,
       prosrc like '%UNAUTHORIZED_ACTOR%' as tiene_0008
from pg_proc where proname = 'confirm_dose_atomic';
```

Confirmado el 2026-09-17: `tiene_0007 = true`.

> **Trampa de las PR apiladas.** El #10 se abrió con base `baja-tratamiento`
> en vez de `master`. GitHub reapunta una PR apilada a `master` solo cuando la
> rama base se **borra**; acá el #9 se mergeó primero sin borrarla, así que el
> #10 se mergeó adentro de una rama ya muerta y sus cambios nunca llegaron a
> `master`. Figura "MERGED" igual, que es lo que lo hace fácil de no ver.
> Si se vuelve a apilar una PR: verificar con
> `git fetch origin && git diff --stat origin/master origin/<rama>` después de
> mergear, no confiar en el estado que muestra GitHub. Comparar contra
> `origin/master`, no contra `master` a secas: el local queda desatrasado y da
> un falso positivo.

```bash
npm run typecheck && npx vitest run && npx jest --config jest.config.js
```

---

## Lo próximo (orden acordado con el usuario)

Los tres puntos del orden acordado ya están hechos. Queda abierto el
trabajo grande que el punto 1 dejó a medias.

### 1. Offline — hecho a medias (PR #8, mergeado)

Lo que resuelve: leer sin red. Lo que **no**:

- **Confirmar una toma sin red sigue fallando.** Es el trabajo grande que
  queda: necesita cola, reintentos y resolución de conflictos contra la RPC
  atómica `confirm_dose_atomic`.
- **Token vencido sin red** = no hay sesión que restaurar. Mitigarlo implica
  confiar localmente en un token vencido: decisión de seguridad del usuario.

### 2. Dar de baja / editar un tratamiento — HECHO (PR #9, abierto)

`ChangeTreatmentStatusUseCase` pausa, reanuda y da de baja, apagando (o
volviendo a programar) las alarmas futuras. Lo que **falta** de este punto es
**editar**: cambiar la posología, el horario o la dosis de un tratamiento ya
creado sigue sin existir. Hoy la única salida es dar de baja y cargar uno
nuevo, que parte el historial de adherencia en dos.

Lo que aprendí implementándolo, por si se toca de nuevo:

- Pausar era una **puerta de una sola dirección**: el tratamiento pausado sale
  de la grilla y del aviso de stock, así que no quedaba ningún camino para
  volver a abrirlo. Lo resuelve `GetPausedTreatmentsUseCase` + la sección
  "En pausa" en la home. Cualquier estado nuevo que esconda un tratamiento
  necesita su propio camino de vuelta.
- Las dosis PENDING ya generadas **no se borran** (migración 0006). El filtro
  del PR #4 las esconde y reanudar devuelve la semana intacta.
- **Dar de baja nunca se ejecutó contra los datos reales**: no se puede
  deshacer y cuál de los dos 18F-COLINA duplicados muere es decisión del
  usuario. Se verificó hasta el diálogo de confirmación.

### 3. Dos arreglos chicos — HECHO (PR #10, abierto, apilado sobre #9)

---

## Decisiones abiertas del usuario (preguntadas, sin responder)

1. ~~**¿Quedarse sin stock debe impedir confirmar una toma?**~~ **RESUELTA**
   (PR #12 + migración 0007, aplicada). Respuesta: no. El stock baja hasta cero
   y lo que faltó se informa como aviso no bloqueante. Lección cara: al mover
   la búsqueda del tratamiento antes del UPDATE se perdió sin querer el freno
   que abortaba cuando el UPDATE no tocaba ninguna fila — lo arregla la 0008.
   Tocar el orden de sentencias en una función plpgsql puede sacar del medio
   una comprobación que ni siquiera parecía una comprobación.
2. **Migración 0006.** `supabase/migrations/` llega hasta `0005`, pero existe un
   `0006_reschedule_and_cancel_treatment.sql` en la copia de agosto en
   `D:\descargas\pastillero-visual-core(4)\supabase\migrations\`, y `git log --all`
   confirma que **nunca estuvo en el repo**. Si está aplicada en producción,
   clonar y migrar da un esquema distinto. Hay que recuperarla o revertirla.
3. **Sitio web**: 10 huecos `[COMPLETAR]` (responsable, domicilio, correo,
   región de Supabase, plazo de borrado, fecha de vigencia) y la política de
   privacidad necesita revisión legal — maneja datos de salud, sensibles bajo
   la Ley 25.326. Detalle en `web/README.md`.

---

## Deuda técnica conocida

- **`slotLabel` mezcla dos cosas.** El dominio lo define como ranura del
  pastillero, pero `SqliteMedicationVisualSuggestionProvider` le mete la
  concentración de ANMAT. Arreglado solo en superficie (rótulo neutro en voz y
  chip en pantalla). El arreglo de fondo es separarlo en `VisualProfile`: toca
  migración, mappers de SQLite y Supabase, y la pantalla de alta.
- **El checkbox "Todos los días" no hace nada.** El tratamiento se guarda como
  `DAILY` esté tildado o no; `weekdays` no tiene forma de cargarse. Está
  documentado en `DosageAndStockForm` como simplificación deliberada. Ya hay un
  patrón de chips ahí que lo resolvería barato.
- **El catálogo ANMAT no tiene versión ni scraper.** `data/vademecum-anmat.csv`
  (16.139 filas) es un scrape del 2026-08-24; el script que lo produjo se
  perdió. Ver `data/README.md`.

---

## Release v1.0.0 (APK)

Primer APK publicado el 2026-09-17: `v1.0.0`, tag sobre `a9cc090`.

- Se construye **desde el proyecto host**, no desde el Core:
  `cd /d/PastilleroVisualHost/android && ./gradlew.bat assembleRelease`
  → `android/app/build/outputs/apk/release/app-release.apk` (~96 MB, universal).
- **Firmado con la keystore de DEBUG** (así viene `release` en el
  `build.gradle` del host). Sirve para instalar a mano; no para Play Store.
  Si algún día se firma con una clave real, **todos tienen que desinstalar
  antes de actualizar**: cambia la firma.
- ProGuard está **desactivado** en release, y el APK es **universal** (no
  partido por arquitectura): un solo archivo sirve para cualquier teléfono.
- El nombre visible es **"Pastillero"** (`android/app/src/main/res/values/strings.xml`
  del host). Antes decía "PastilleroVisualHost", que era el nombre del
  proyecto, no el de la app. **Ese cambio está SIN COMMITEAR en el repo del
  host** — si alguien clona el host limpio, el APK vuelve a salir con el
  nombre viejo.
- El repo es **privado**, así que el asset del Release **no se puede
  descargar sin acceso**. Se reparte a mano (Drive/WhatsApp); el Release es
  el registro versionado de qué se entregó.
- Verificado en el emulador: el APK arranca **sin Metro**, con los datos
  reales y la sesión intacta.

---

## Entorno (Windows) — trampas ya resueltas

El Core **no tiene `android/` ni `ios/`**. La app corre desde un proyecto host
aparte en `D:\PastilleroVisualHost`, cuyo `src/` es una **copia**, no un symlink:

```bash
cp -r /d/pastillero-visual-core/src/. /d/PastilleroVisualHost/src/
```

Con Metro andando, Fast Refresh toma el cambio en ~8s. Cambios en `bootstrap.ts`
necesitan `force-stop` + relanzar.

- `adb` y `emulator` no están en PATH:
  `/c/Users/tomas/AppData/Local/Android/Sdk/{platform-tools,emulator}`.
  AVD: `Pixel_10_Pro_XL`.
- **Los screenshots se muestran a 898x2000 pero el device es 1344x2992** —
  multiplicar las coordenadas de tap por **1.50** o los toques erran.
- `npx react-native start` desde la herramienta Bash devuelve output vacío y el
  task "completa", pero **Metro sí queda corriendo**. Verificar con
  `curl localhost:8081/status`, no por el log.
- `adb shell` con rutas absolutas necesita `MSYS_NO_PATHCONV=1`. Para leer un
  binario del device usar `adb exec-out`, nunca `adb shell cat` (lo corrompe).
- El primer bundle tras `--reset-cache` tarda ~45s; conviene pedirlo con `curl`
  antes de lanzar la app.
- **El emulador no tiene root** (imagen de producción): no se puede editar
  `/etc/hosts` ni usar `adb remount`.

### Cómo probar sin red

El modo avión **no sirve**: el build de debug carga el JS desde Metro por red y
no arranca. Hay que romper solo Supabase, **en la copia del host**:

```bash
# en D:\PastilleroVisualHost\src\infrastructure\config\supabase-config.ts
https://eoqrxunmurexizrcoilb.supabase.co  →  https://eoqrxunmurexizrcoilb.supabase.invalid
```

**Conservar el project ref** (`eoqrxunmurexizrcoilb`): la sesión se guarda en
AsyncStorage con una clave derivada de él. Cambiando el proyecto entero se prueba
"otro proyecto", no "sin red" — ese error ya se cometió una vez.

Acordarse de restaurarlo después. El repo nunca se toca.

### Supabase

Plan gratuito: **se auto-pausa tras 1 SEMANA de inactividad** (no unos días —
esto se verificó contra la documentación después de haberlo exagerado). La
propia documentación dice que "unas pocas consultas por día durante la semana
previa" alcanzan para evitarlo, así que **abrir la app una vez por día es
suficiente**; entrar al dashboard también cuenta.

Supabase manda **dos mails al dueño del proyecto**: uno de aviso una semana
antes de pausar, y otro cuando ya pausó. No agarra de sorpresa.

El síntoma, si llega a pasar, es NXDOMAIN al resolver el host y parece un
problema de red. Se despausa desde el dashboard.

Riesgo real acotado: una semana entera sin que nadie abra la app (viaje,
enfermedad). Los que se comen la app rota son los familiares, que no van a
saber explicar qué pasó.

**Sobre pasar a Pro:** el argumento de la pausa es débil, y el de las
contraseñas filtradas ya se resolvió del lado de la app (PR #15). El motivo de
peso, si alguna vez se evalúa, es otro: **el plan gratuito no tiene backups**;
Pro hace copias diarias con 7 días de retención. Para datos de salud reales eso
pesa más que las otras dos cosas.

---

## Datos reales en la cuenta de prueba

Útiles para no confundir bugs con datos:

- Hay **dos tratamientos "18F-COLINA"**: es el mismo medicamento cargado dos
  veces, consecuencia del horizonte que se apagaba (ya arreglado en #7). Uno
  quedó abandonado y arrastra la adherencia para abajo.
- La adherencia baja (10-11%) es **real**, no un bug de cálculo.
- Un tratamiento tiene el stock en **0 ml**. Sus dosis **sí** se pueden
  confirmar desde el PR #12 + migración 0007: se registran y muestran el
  aviso naranja "Quedó registrada. Avisale a tu cuidador…". Verificado de
  punta a punta el 2026-09-17 en el emulador contra la base real.
- El 2026-09-17, cerrando esa verificación, se confirmaron **dos tomas
  reales más** con permiso del usuario: ABIRATERON-A (noche 00:00) y
  18F-COLINA (mañana, la de stock cero). Ambas figuran como TOMADAS y no
  ocurrieron: son artefactos de prueba, no adherencia real.
- El 2026-09-17 se confirmó una toma real de ABIRATERON-A (jueves noche) al
  probar el flujo de punta a punta. Quedó como tomada, con stock descontado.

---

## Segunda ronda: feedback de las primeras pruebas con familia (2026-09-18)

Seis pedidos, partidos en cuatro PRs por dependencias entre ellos:

| # | PR | Qué incluye | Estado |
|---|----|-------------|--------|
| A | #17 `dos-roles-una-cuenta` | Un mismo mail puede ser Adulto Mayor Y Cuidador + selector "¿cómo querés entrar?" al inicio | Mergeada. Migración 0010 aplicada (según el usuario; no la pude verificar desde acá). |
| B | #18 `codigos-de-vinculacion` | Un código por cuidador (hasta 3), generar y dar de baja, desvincular | **Abierta. Necesita migración 0011.** |
| C | #19 `home-de-pacientes` | Home del Cuidador con la lista de sus pacientes por nombre | **Abierta. Sin migración.** Sale de `master`: hay que meterle `master` adentro después de mergear la #18. |
| D | — | El Adulto Mayor ve el nombre de su(s) cuidador(es) y quién cargó cada tratamiento | Pendiente |

**Por qué ese orden:** A cambia la forma de `Session` y el modelo de roles, así que
hacerlo último obligaría a rehacer B, C y D. B y el pedido de "regenerar código" son
el mismo trabajo (una tabla de códigos), por eso van juntos. D depende de B, porque
"el cuidador a cargo" pasa a ser una lista, no uno solo.

### Estado de migraciones tras esta ronda

`0010` la reportó aplicada el usuario. `0011_codigos_de_vinculacion.sql` **todavía
no**. Verificación de solo lectura en el SQL Editor de Supabase:

```sql
select
  exists (select 1 from information_schema.columns
           where table_name = 'profiles' and column_name = 'is_patient')  as tiene_0010,
  exists (select 1 from information_schema.tables
           where table_name = 'patient_invite_codes')                     as tiene_0011;
```

**No se puede verificar desde afuera con la anon key**: el rol `anon` no tiene
permisos sobre `profiles`, así que PostgREST no expone nada en su esquema y la
respuesta vacía no prueba ni que esté ni que no esté. Hay que correr el SQL de
arriba en el SQL Editor.

Sin 0010, la app sigue andando con un solo rol por cuenta: `mapRowToProfile` deriva
`isPatient`/`isCaregiver` de `role` cuando las columnas no vienen. Lo que NO anda sin
la migración es activar el segundo rol (el UPDATE apunta a una columna inexistente).

Sin 0011, la pantalla "Mis cuidadores" muestra su estado de error con un reintento —
no rompe, pero no sirve.

### Verificado en el emulador contra el proyecto real (2026-09-18)

Con 0010 aplicada, sobre la cuenta `colladofacu5@gmail.com` (el usuario autorizó
explícitamente activarle el segundo rol):

- **Activar el rol de Cuidador** desde el selector: el UPDATE a `is_caregiver`
  funciona y el selector pasa a ofrecer los dos roles. Cierra la PR #17 de punta a punta.
- **`MisPacientes` como raíz** del stack del Cuidador, cayendo en el estado "vinculá a
  tu Adulto Mayor" porque esa cuenta no cuida a nadie.
- **El join anidado `profiles!<columna>(display_name)` ANDA**: la pantalla mostró la
  rama de lista vacía, no la de error, así que `findPatientsByCaregiver` volvió OK
  desde PostgREST. `findCaregiversByPatient` (PR #18) usa exactamente la misma forma.
- **`CANNOT_LINK_TO_SELF`**: cargar el código propio (`RMMAPJ`) devuelve "Ese es tu
  propio código. Necesitás el de la persona que vas a cuidar."

Queda sin probar en vivo, por necesitar una segunda cuenta que no puedo crear: la
lista con DOS o más pacientes, y todo el flujo de códigos de la #18 (necesita 0011).
