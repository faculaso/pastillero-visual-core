# Pastillero Visual — Core

Núcleo de dominio, aplicación, infraestructura y presentación de la plataforma de gestión visual de medicación, según la especificación de casos de uso (CU-01, CU-02, CU-03).

## Arquitectura

Clean Architecture / DDD en 4 capas, cada una dependiendo solo de la anterior:

```
src/
├── domain/          # Entidades, enums, VOs, invariantes (factories), contratos de repositorio.
│                     # Cero dependencias externas. Pure TS.
├── application/      # Use cases (orquestación), DTOs, puertos técnicos (Clock, IdGenerator,
│                     # TransactionRunner, NotificationScheduler). Depende solo de `domain`.
├── infrastructure/    # Implementaciones concretas: repos SQLite, adapters (op-sqlite /
│                     # better-sqlite3), migraciones, servicios del sistema, bootstrap().
│                     # Depende de `domain` + `application`.
└── presentation/      # React Native + Zustand + React Navigation. Design system accesible,
                      # pantallas, stores. Depende solo de tipos de `application` — NUNCA
                      # importa `infrastructure` directamente (ver UseCasesProvider).

scripts/
└── seed-anmat-catalog.ts  # CLI de ingesta del Vademécum ANMAT (Node/CI, no corre en el device)

host-integration/          # Artefactos listos para copiar al proyecto host RN (ver su propio README)
├── index.js
└── AndroidManifest.xml
```

**Regla de dependencia**: `presentation → application ← infrastructure`, y ambas `→ domain`. El único archivo que conoce las 4 capas a la vez es `src/infrastructure/bootstrap.ts`.

### Casos de uso implementados

| Código | Nombre | Use case | Pantalla |
|---|---|---|---|
| CU-01 | Registrar Tratamiento | `RegisterTreatmentUseCase` (+ `SearchMedicationCatalogUseCase`) | `RegisterTreatmentScreen` |
| CU-02 | Confirmar Toma | `ConfirmDoseUseCase` (+ `GetPendingDosesForPatientUseCase`) | `PastilleroVirtualScreen` |
| CU-03 | Monitorear Adherencia y Stock | `MonitorAdherenceUseCase` + `UpdateStockUseCase` | `AdherenceDashboardScreen` |

## Requisitos

- Node.js 18+
- Para correr en dispositivo/emulador real: entorno React Native estándar (Xcode/Android Studio) — este repo es el **Core** (lógica + UI), no un proyecto RN completo con `ios/`/`android/` nativos.

## Instalación

```bash
npm install
```

## Scripts

| Script | Qué hace |
|---|---|
| `npm test` | Corre **toda** la suite (Vitest + Jest) |
| `npm run test:unit` | Solo unitarios de dominio/aplicación (Vitest) |
| `npm run test:integration` | Solo integración SQLite real (Vitest + better-sqlite3) |
| `npm run test:ui` | Solo tests de componentes/pantallas RN (Jest) |
| `npm run test:watch` | Vitest en modo watch |
| `npm run test:ui:watch` | Jest en modo watch |
| `npm run typecheck` | `tsc --noEmit` de todo el repo (core + scripts + tests de UI) |
| `npm run seed:anmat` | Ingesta el CSV del Vademécum ANMAT a la caché SQLite (ver sección dedicada abajo) |
| `npm run verify:host` | Preflight del proyecto host antes de compilar (ver "Integración con el host RN" abajo) |

## Por qué dos test runners

`react-native` distribuye su código fuente con sintaxis **Flow**, que el parser de Vitest (esbuild/rolldown) no soporta sin el transform de Babel/Metro. Por eso:

- **Vitest** corre `tests/unit/**` y `tests/integration/**`: dominio, aplicación e infraestructura SQLite — todo TypeScript puro, sin `react-native` en el import graph. Rápido, sin necesidad de Babel.
- **Jest** (con `@react-native/jest-preset`) corre `tests/ui/**`: cualquier test que importe un componente de `react-native`. Configuración en `jest.config.js` / `babel.config.js`.

Cada runner tiene su propio `tsconfig` (`tsconfig.json` para Vitest, `tests/ui/tsconfig.json` para Jest) porque `vitest/globals` y `@types/jest` declaran los mismos globals (`describe`, `expect`, etc.) con firmas distintas — mezclarlos en un solo `tsconfig` produce choques de tipos.

## Guía de inicio rápido

### 1. Correr los tests

```bash
npm test
```

Debería dar **146 tests en verde** (128 Vitest + 18 Jest) y `npm run typecheck` sin errores.

### 2. Explorar el dominio primero

Si es tu primera vez en el repo, el orden de lectura recomendado:

1. `src/domain/entities/treatment.entity.ts` — el agregado raíz.
2. `src/domain/factories/*.ts` — invariantes de negocio (todo devuelve `Result<T, DomainError>`, nunca `throw`).
3. `src/application/use-cases/confirm-dose.use-case.ts` — el flujo más crítico (transacción atómica confirmar-toma + decrementar-stock).
4. `src/infrastructure/persistence/sqlite/sqlite-transaction-context.ts` — cómo se garantiza esa atomicidad contra SQLite real.
5. `src/presentation/screens/pastillero-virtual/PastilleroVirtualScreen.tsx` — la pantalla que consume todo lo anterior.

### 3. Levantar la app en un proyecto RN real

Este repo es el **Core** — para correrlo en un dispositivo hace falta embeberlo en un proyecto React Native con `ios/`/`android/` nativos generados (`npx @react-native-community/cli init`, o Expo bare). Pasos:

1. Copiar `src/` a tu proyecto RN (o publicarlo como paquete interno).
2. Copiar los artefactos de **`host-integration/`** — `index.js` (entry point con el handler de background de notifee) y `AndroidManifest.xml` (todos los permisos/queries que requieren notifee, la captura de fotos y TTS). Ver `host-integration/README.md` para el detalle paso a paso.
3. Agregar `android/app/src/main/res/raw/medical_alarm.mp3` — el único asset binario que este Core no puede proveer.
4. Agregar `android/app/src/main/res/drawable/ic_notification.xml` (o `.png` por densidad) — el ícono chico de la barra de estado, que `notifee-notification-scheduler.ts` pide por nombre. **Sin él no se muestra NINGUNA alarma de toma**: Android rechaza la notificación entera con `Invalid notification (no valid small icon)`. Silueta blanca sobre transparente; el sistema la recolorea.
5. Pod install / gradle sync — todos los módulos nativos ya están en `dependencies` de `package.json`.
6. **Correr el preflight antes de compilar**: `npm run verify:host` (o `npx tsx scripts/verify-host-env.ts --project-root <path>` si tu proyecto RN vive en otra carpeta). Chequea dependencias, permisos del manifest, el asset de sonido, el ícono de notificación, y que `index.js` registre el handler de background en el orden correcto — antes de que un problema de config se descubra como un crash en el dispositivo.

`src/presentation/App.tsx` es el componente raíz de producción: llama a `bootstrap()`, maneja los estados de carga/error con reintento, y envuelve la navegación en un `ErrorBoundary`.

### 4. Reemplazar los stubs antes de producción

Una pieza ya está resuelta, otra sigue pendiente:

- ~~`NoopNotificationScheduler`~~ — **reemplazado** por `NotifeeNotificationScheduler` (ver sección "Notificaciones y alarmas" más abajo). El stub sigue existiendo en el código por si algún build lo necesita explícitamente (tests, modo demo), pero ya no es el default.
- **`SessionContext`** (`src/presentation/providers/`): no hay login real, usa un `patientId`/`caregiverId` de demo fijos tras elegir el rol en `RoleSelectScreen`. Reemplazar por auth real.

## Integración con el host RN (`host-integration/` + preflight)

Todo lo que el Core no puede proveer por sí solo (porque no es código TS, es configuración/assets del árbol nativo) vive en `host-integration/`:

| Archivo | Reemplaza en el host |
|---|---|
| `host-integration/index.js` | `index.js` (raíz del proyecto) |
| `host-integration/AndroidManifest.xml` | `android/app/src/main/AndroidManifest.xml` |

### La pieza no obvia: orden de registro en `index.js`

`notifee.onBackgroundEvent` tiene que registrarse ANTES de `AppRegistry.registerComponent`, fuera de cualquier componente React — un evento de background puede llegar con la app completamente cerrada, y en ese caso RN levanta un contexto headless nuevo sin ningún componente montado. `host-integration/index.js` ya lo tiene en el orden correcto; `scripts/verify-host-env.ts` lo valida automáticamente (heurística de posición de texto: `onBackgroundEvent` antes que `registerComponent` en el archivo).

### El permiso que faltaba: TTS y "package visibility" (Android 11+)

Un hallazgo real durante esta integración: Android 11+ restringe qué apps/servicios puede ver cada app instalada ("package visibility"), lo que incluye los motores TTS del sistema — sin declarar `<queries>` explícitamente, `react-native-tts` puede no encontrar ningún motor instalado aunque haya uno funcionando. `host-integration/AndroidManifest.xml` ya lo incluye.

### `scripts/verify-host-env.ts` — preflight

```bash
npm run verify:host
# o, si tu proyecto RN vive en otra carpeta:
npx tsx scripts/verify-host-env.ts --project-root /ruta/al/proyecto-rn
```

8 checks: versión de Node, dependencias nativas declaradas en `package.json` (incluyendo `peerDependencies`), esos mismos paquetes efectivamente instalados en `node_modules`, permisos requeridos presentes en el `AndroidManifest.xml`, el asset `medical_alarm.mp3`, el orden de registro en `index.js`, y las variables de entorno `ANDROID_HOME`/`JAVA_HOME`. Solo los `fail` bloquean (exit code 1); los `warn` no.

Corrido dentro de este Core (no del host) va a reportar fallas esperables — es información correcta, no un bug: `android/`, `index.js` en la raíz, etc. genuinamente no existen acá, porque no es el host.

**Tests**: `tests/unit/scripts/verify-host-env.test.ts` (Vitest — el script es Node/TS puro, sin imports de `react-native`, así que no necesita el runner de Jest) contra directorios temporales reales (`mkdtempSync`), no mocks de filesystem.

## Catálogo ANMAT (Vademécum Nacional de Medicamentos)

El catálogo local (`medications`) se puede enriquecer con el dataset abierto de ANMAT, manteniendo la premisa offline-first: **la app nunca descarga el catálogo en runtime**, solo consume una caché SQLite ya poblada.

### Cómo ingestar

1. Descargar el CSV del Vademécum (fuera de este repo — `datos.gob.ar` u otra fuente oficial; el script no hace `fetch`, es deliberado: mantiene la ingesta determinística y testeable sin depender de la disponibilidad de un endpoint externo en cada corrida).
2. Correr:
   ```bash
   npm run seed:anmat -- --input vademecum.csv --db pastillero.db
   ```
   Flags: `--delimiter` (default `;`), `--batch-size` (default `500`), `--dry-run` (valida sin escribir).
3. El `pastillero.db` resultante se embebe como asset de la app (o se sube a donde la app lo vaya a descargar como parte de un flujo de sync de catálogo — ese flujo es infraestructura aparte, no este script).

### Diseño

- **El dominio no conoce ANMAT**: la entidad `Medication` (`src/domain`) no cambió. Los campos oficiales (`nro_certificado`, `forma_farmaceutica`, `concentracion`, `presentacion_unidades`) viven como columnas adicionales en `medications` (migración `002_anmat_catalog_fields.sql`), consumidas solo desde infraestructura.
- **Búsqueda**: FTS5 (`medications_fts`, external-content sobre `name`/`active_ingredient`) con triggers de sincronización automática. Si el build de SQLite no trae FTS5 compilado, `SqliteMedicationCatalogRepository` lo detecta en runtime y cae a `LIKE` sobre índices `COLLATE NOCASE` — sin romper la búsqueda.
- **Auto-completado del formulario (CU-01)**: `SuggestVisualProfileUseCase` (puerto `MedicationVisualSuggestionProvider` en `application`, no en `domain`) traduce `forma_farmaceutica` → `PillShape` y parsea `presentacion_unidades` para sugerir stock inicial. Conectado en `RegisterTreatmentScreen`: al elegir un medicamento, prefila forma/ranura/stock — siempre editable, nunca bloqueante (best-effort con `try/catch`).
- Mappers puros (testeables sin DB) en `src/infrastructure/persistence/sqlite/anmat/`.

## Notificaciones y alarmas (CU-02/CU-03)

`NotificationScheduler` (puerto en `application/ports`) tiene una implementación real sobre [`@notifee/react-native`](https://notifee.app/) en `src/infrastructure/services/notifee/`. Reemplaza al `NoopNotificationScheduler` como default en `bootstrap()`.

### Qué hace

- **Dos canales de Android**: `dose-reminders` (importancia máxima, sonido de alarma propio, vibración larga, visible en pantalla de bloqueo, bypassea Do Not Disturb) y `stock-alerts` (importancia alta, sin el tratamiento de "alarma").
- **Scheduling exacto**: cada `Dose` ya viene con su `scheduledAt` (materializado por `RegisterTreatmentUseCase`), así que se programa un `TimestampTrigger` con `AlarmType.SET_EXACT_AND_ALLOW_WHILE_IDLE` — dispara a la hora exacta incluso en Doze.
- **Acciones interactivas**: "Confirmar Toma" ejecuta `ConfirmDoseUseCase` en segundo plano; "Posponer 15 min" reprograma la misma notificación (mismo id, no duplica) 15 minutos más tarde.
- **`fullScreenAction`**: la notificación de toma se puede mostrar a pantalla completa con el dispositivo bloqueado — importante para el perfil de usuario (Adulto Mayor) de CU-02.

### La parte no obvia: foreground vs. background

`notifee.onBackgroundEvent` **debe** registrarse en el `index.js` real de la app, antes de `AppRegistry.registerComponent`, y puede dispararse con la app completamente cerrada (proceso matado) — en ese caso no hay ninguna instancia de `NotifeeNotificationScheduler` "viva" a la que engancharse. Por eso la lógica de interacción (confirmar/posponer) está en funciones standalone, no en métodos de instancia:

- `scheduler.registerForegroundHandler()` — para cuando la app está abierta; se llama automáticamente dentro de `bootstrap()`.
- `createBackgroundEventHandler(getConfirmDoseUseCase)` — factory que hace su propio bootstrap perezoso en cada invocación; se registra manualmente en `index.js` (ver `android-config-reference/index.js.snippet.ts`).

### Configuración nativa requerida

- `android-config-reference/AndroidManifest.snippet.xml` — permisos (`POST_NOTIFICATIONS`, `SCHEDULE_EXACT_ALARM`/`USE_EXACT_ALARM`, `USE_FULL_SCREEN_INTENT`, `VIBRATE`, `RECEIVE_BOOT_COMPLETED`, `WAKE_LOCK`) a fusionar en el manifest real del proyecto RN.
- `android-config-reference/index.js.snippet.ts` — dónde registrar el handler de background.
- Falta agregar `android/app/src/main/res/raw/medical_alarm.mp3` en el proyecto RN real (el canal `dose-reminders` lo referencia por nombre; sin el archivo, Android cae al sonido default sin avisar del error).
- Falta agregar `android/app/src/main/res/drawable/ic_notification.xml` en el proyecto RN real. Este no degrada: sin el ícono **no se muestra ninguna notificación**, ni de toma ni de stock. Pasó de verdad — la alarma disparaba puntual, el log decía `Invalid notification (no valid small icon)`, y en el teléfono no aparecía nada.

### Tests

`tests/native/notifee-notification-scheduler.test.ts` (Jest — notifee también requiere `react-native` en runtime, mismo motivo que `tests/ui`). Mockea `@notifee/react-native` completo con `jest.mock`; nota de implementación: el factory de `jest.mock` tiene que ser autocontenido (crear los `jest.fn()` adentro), porque los `import` del archivo se hoistean por sobre cualquier `const` externo que el factory quisiera referenciar.

## Captura y almacenamiento de fotos de la caja (CU-01)

`LocalImageStorageService` (puerto en `application/ports`) tiene una implementación real sobre [`react-native-fs`](https://github.com/itinance/react-native-fs) en `src/infrastructure/services/image-storage/`. La captura en sí usa [`react-native-image-picker`](https://github.com/react-native-image-picker/react-native-image-picker), integrada en `BoxPhotoCaptureField` (dentro de `VisualProfileEditor`, en `RegisterTreatmentScreen`).

### Qué hace

- **Cámara o galería**: dos botones ("Sacar foto" / "Elegir de galería") vía `launchCamera`/`launchImageLibrary`.
- **Copia a almacenamiento persistente ANTES de tocar el formulario**: el picker devuelve una URI temporal (caché del SO, se puede limpiar en cualquier momento); `RNFSLocalImageStorageService.saveImage()` la copia a `RNFS.DocumentDirectoryPath/box-images/` (directorio privado de la app, no se limpia automáticamente) y recién esa URI persistente se guarda en `VisualProfile.boxImageUrl` — nunca se persiste la URI temporal directamente, para no terminar con una "foto rota" silenciosa días después.
- **Fallback automático en `PillVisual`**: si la foto no carga (`onError` — archivo borrado externamente, corrupción, etc.), cae al perfil geométrico (forma + color) en vez de mostrar un ícono roto. Prioridad: `pillImageUrl` > `boxImageUrl` > geométrico.
- **Accesibilidad**: la imagen (real o el fallback geométrico) lleva `accessibilityLabel` con el nombre del medicamento cuando está disponible (`CurrentDoseCard` se lo pasa a `PillVisual`).

### Configuración nativa requerida

`android-config-reference/AndroidManifest.snippet.xml` incluye, además de lo de notifee: `CAMERA`, `READ_MEDIA_IMAGES` (Android 13+) / `READ_EXTERNAL_STORAGE` con `maxSdkVersion="32"` (legacy), y un `<uses-feature android:name="android.hardware.camera" required="false">` (para no excluir la app de dispositivos sin cámara, ya que la galería sigue siendo una alternativa válida). El `FileProvider` que `launchCamera()` necesita para el archivo de salida **no** hay que declararlo a mano — `react-native-image-picker` ya lo aporta vía manifest merging de Gradle, igual que notifee con sus receivers.

### Tests

- `tests/unit/infrastructure/image-storage/image-path.utils.test.ts` (Vitest) — funciones puras de inferencia de extensión y normalización de path, sin tocar RNFS.
- `tests/native/rnfs-local-image-storage.service.test.ts` (Jest) — `RNFSLocalImageStorageService` con `react-native-fs` mockeado.
- `tests/ui/BoxPhotoCaptureField.test.tsx` (Jest) — flujo completo de captura/cancelación/error, con `react-native-image-picker` mockeado.

Nota: `react-native-image-picker` distribuye su código fuente en TS **sin compilar** (`main` apunta a `src/index.ts`) — no es el problema de Flow de `react-native`, es simplemente TS crudo que Jest no puede parsear sin transformarlo. En vez de agregarlo al `transformIgnorePatterns`, se mockea completo con `jest.mock()` en cada test que lo toca (transitivamente, vía `BoxPhotoCaptureField`) — el módulo real nunca llega a cargarse.

## Asistencia por voz (Text-to-Speech, CU-02)

`VoiceGuidancePort` (puerto en `application/ports`) tiene una implementación real sobre [`react-native-tts`](https://github.com/ak1394/react-native-tts) en `src/infrastructure/services/tts/`. El botón "Escuchar indicaciones" vive en `VoiceGuidanceButton`, integrado dentro de `CurrentDoseCard` (`PastilleroVirtualScreen`, CU-02).

### La parte no obvia: `Tts.speak()` no es una Promise de finalización

`react-native-tts` expone `speak()` como una llamada **síncrona** que devuelve un id de utterance — el final de la locución se notifica por eventos (`tts-finish`, `tts-cancel`, `tts-error`), no por la resolución de una promesa. `ReactNativeTtsService.speak()` envuelve eso en una Promise real, filtrando los eventos por `utteranceId` (para no resolver la llamada equivocada si en algún momento hay más de un `speak()` en simultáneo) y limpiando los listeners al terminar. Gracias a esto, `VoiceGuidancePort.speak()` resuelve recién cuando el audio **termina** de reproducirse — no cuando arranca — y `VoiceGuidanceButton` puede mostrar un toggle "Escuchar indicaciones" ↔ "Detener" que refleja el estado real, no una animación optimista.

### Qué lee en voz alta

`buildDoseVoiceMessage` (función pura, testeada sin RN) compone: nombre del medicamento, dosis (en palabras completas — "miligramos", no "mg", porque un TTS lee mal las abreviaturas), forma del comprimido, ranura del pastillero si está configurada, y la instrucción de confirmar la toma. Frases cortas separadas por punto, no un párrafo corrido — importa más para un TTS ya ralentizado a propósito.

### Velocidad y tono para adultos mayores

`ReactNativeTtsService` fija por default `rate: 0.35` (notablemente más lento que el ~0.5 default del motor nativo) y `pitch: 1.0`, en español (`es-AR` por default, `es-ES` u otro configurable por llamada vía `options.language`) — mismo perfil de usuario que ya justifica los touch targets grandes del design system: dar tiempo a procesar cada palabra importa más que sonar natural.

### Duplicación deliberada: `formatDosageLabel`

Presentación ya necesitaba formatear una `Dosage` a texto en otro lugar (`infrastructure/services/notifee/format-dosage-label.ts`, para el cuerpo de la notificación). En vez de reutilizarla, `presentation/utils/format-dosage-label.ts` es una copia separada (~10 líneas): presentación no puede importar infraestructura (regla de dependencia de la arquitectura), e infra tampoco debería depender de presentación. Además las dos versiones difieren a propósito — la de notifee usa abreviaturas ("mg") para una notificación compacta, la de voz usa palabras completas ("miligramos") porque un TTS las lee mal abreviadas.

### Configuración nativa requerida

Ninguna. `android-config-reference/AndroidManifest.snippet.xml` lo documenta explícitamente: `react-native-tts` usa el motor TTS ya instalado del sistema operativo vía las APIs públicas de Android, sin permisos ni entradas de manifest propias. Si el dispositivo no tiene ningún motor TTS instalado, `Tts.getInitStatus()` rechaza con `no_engine`, que `ReactNativeTtsService` propaga como `REPOSITORY_FAILURE` — `VoiceGuidanceButton` lo muestra como error visible en vez de fallar en silencio.

### Tests

- `tests/unit/presentation/voice-message.test.ts` (Vitest) — `buildDoseVoiceMessage`, pura.
- `tests/native/react-native-tts.service.test.ts` (Jest) — `ReactNativeTtsService` con un mock de `react-native-tts` que es un emisor de eventos real (no solo `jest.fn()`s sueltos), necesario para simular `tts-finish`/`tts-cancel`/`tts-error` disparándose de verdad. Cubre además que no queden listeners colgados tras resolver.
- `tests/ui/VoiceGuidanceButton.test.tsx` (Jest) — toggle Escuchar/Detener, manejo de error.
- `tests/ui/PastilleroVirtualScreen.test.tsx` — confirma que el botón aparece integrado en el flujo real de la pantalla, no solo en aislamiento.

## Rediseño visual y de interacción (CU-01/CU-02)

Capa puramente presentacional sobre lo ya construido — no toca dominio salvo una pieza real de datos que faltaba (ver abajo).

### Código cromático por turno horario

`src/presentation/utils/time-of-day-theme.ts` — función pura `getTimeOfDayTheme(date)` que deriva mañana (5-12hs, celeste)/tarde (12-19hs, ámbar)/noche (19-5hs, índigo con texto claro) del `scheduledAt` de la dosis. **No** viene de un campo de instrucciones explícito — `DosageScheme` no lo tiene; agregarlo es la extensión natural si el negocio necesita instrucciones libres. `CurrentDoseCard` aplica el tema al fondo completo de la tarjeta.

Dos bugs de contraste encontrados y corregidos en el camino: el badge del turno tenía texto blanco sobre fondo blanco en la noche (su fondo es siempre blanco, independiente del tema), y el label de `InstructionBadge` usaba un gris fijo que se volvía ilegible sobre el fondo índigo oscuro — ambos ahora usan el color de texto correcto según a qué fondo se superponen.

### Selector de colores por círculos

`VisualProfileEditor` ya usaba chips tocables (no inputs de texto) desde una iteración anterior — se ajustó a círculos verdaderos (`borderRadius: pill`) con la paleta exacta pedida (rojo/azul/amarillo/verde/blanco/violeta) y un checkmark visible al seleccionar.

### Iconografía por contexto de toma

`InstructionBadge` — ícono con fondo circular derivado del turno (💧 agua en la mañana, 🍽️ comida en la tarde, 🌙 dormir en la noche). Mismo criterio que el tema de color: heurística sobre el horario, no un campo de dominio nuevo.

### Estados vacíos diferenciados

`EmptyState` ahora recibe `dailyProgress` (mismos datos que la barra de progreso, sin duplicar fuente de verdad) y distingue dos casos: "no tenés tomas pendientes" (neutro) vs. "¡Completaste todas tus tomas de hoy!" (festivo, con ilustración) cuando `totalTaken >= totalScheduled && totalScheduled > 0`.

### Feedback de celebración

`CelebrationOverlay` — checkmark con spring + destello verde esmeralda + confeti sutil, disparado por `celebrationTrigger` (contador en el store que se incrementa en cada confirmación exitosa). `pointerEvents="none"` y marcado oculto para accesibilidad (`accessibilityElementsHidden`) — es decorativo, nunca debe interceptar un toque ni ser leído por un lector de pantalla.

**Nota de testing**: `getByText`/`getByLabelText` de Testing Library excluyen por default los elementos marcados como ocultos para accesibilidad (simulan lo que un lector de pantalla vería) — los tests de `CelebrationOverlay` necesitan `{ includeHiddenElements: true }` explícito para poder verificar su contenido sin dejar de estar ocultos en producción.

### Barra de progreso diario — pieza de dominio real que faltaba

"2 de 3 tomas completadas" necesita saber CUÁNTAS tomas hay programadas hoy en total, no solo las pendientes — `GetPendingDosesForPatientUseCase` (ya existente) solo trae PENDING. Se agregó `DoseRepository.findAllByPatientAndDate` (dominio + SQLite + fake in-memory, con tests de integración) y el nuevo `GetDailyProgressUseCase`, wireados en `bootstrap.ts`. `DailyProgressBar` es una cápsula redondeada (`radii.pill`) sin dependencias de SVG — el efecto "curva" viene de la forma, no de un arco radial.

El store (`pastillero-virtual.store.ts`) refresca el progreso best-effort después de cargar y después de confirmar — con `try/catch` explícito: al ser una llamada fire-and-forget (`void refreshDailyProgress(...)`), un `reject` sin capturar (no solo un `Err` de dominio) rompía los tests con un *unhandled rejection*.

## Convenciones del código

- **`Result<T, DomainError>` en vez de `throw`** en dominio y aplicación: todo caller debe manejar el camino de error explícitamente. Ver `src/domain/core/result.ts`.
- **Entidades = interfaces inmutables** (`readonly`), no clases con métodos. Las invariantes viven en *factories* (`src/domain/factories/`), no en la entidad.
- **Offline-first**: los repos de infraestructura asumen que la app puede escribir sin red; la sincronización remota (Vademécum, backend) es una pieza aparte, fuera de este repo.
- **Accesibilidad como requisito, no feature**: `src/presentation/design-system/tokens.ts` documenta por qué los touch targets y la tipografía son más grandes que el estándar (perfil de usuario: adultos mayores).

## Estructura de tests

```
tests/
├── unit/           # Vitest — dominio + use cases con repos in-memory
├── integration/     # Vitest — repos SQLite reales (better-sqlite3), migraciones, atomicidad
├── ui/              # Jest — componentes y pantallas RN (@testing-library/react-native)
├── native/          # Jest — servicios que importan react-native real pero no son componentes (ej. notifee)
└── support/         # Fixtures y fakes compartidos entre unit/integration
```

Nota sobre `tests/ui`: usa la API `userEvent` de `@testing-library/react-native` (no `fireEvent`) para secuencias de interacción de más de un paso — con React 19, `fireEvent` sin `await` entre eventos puede ejecutar un handler contra una closure desactualizada si el estado no llegó a re-renderizar entre un evento y el siguiente. `userEvent` serializa cada interacción con su propio `act()` async, evitando ese problema de raíz.
