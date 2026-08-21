# host-integration/

Artefactos **listos para copiar** al proyecto host RN real (generado con
`npx @react-native-community/cli init` o Expo bare). Este Core no incluye
`android/`/`ios/` — estos son los archivos que le faltan al host para que
todo lo de `src/` (SQLite, notifee, fotos, TTS) funcione en un build real.

## Pasos

1. **`index.js`** → reemplaza el `index.js` en la raíz del proyecto host.
   Ajustá los imports de `App`/`bootstrap`/`createBackgroundEventHandler`
   si copiaste `src/` a una ruta distinta de `./src/`.

2. **`AndroidManifest.xml`** → reemplaza
   `android/app/src/main/AndroidManifest.xml`. Si tu proyecto ya tiene
   personalizaciones propias (deep links, otros permisos), no lo
   reemplaces entero — fusioná las secciones `PERMISOS`/`QUERIES` adentro
   del tuyo. **Ajustá** `android:name`, `@string/app_name`, `@mipmap/ic_launcher`
   y `@style/AppTheme` si tu proyecto usa nombres distintos a los que
   genera el template estándar de RN.

3. **`android/app/src/main/res/raw/medical_alarm.mp3`** — el único asset
   binario que este Core no puede proveer (no es código). Formato
   recomendado: mp3 u ogg, 2-4s, volumen normalizado. Sin este archivo, el
   canal `dose-reminders` cae al sonido default de notificación de Android
   sin avisar del error — `scripts/verify-host-env.ts` lo detecta antes del
   build.

4. **Pod install / gradle sync** de los módulos nativos — ya están
   declarados en `package.json` (`dependencies`): `@op-engineering/op-sqlite`,
   `@notifee/react-native`, `react-native-fs`, `react-native-image-picker`,
   `react-native-tts`, `@react-navigation/*`, `react-native-screens`,
   `react-native-safe-area-context`.

5. Correr `npx tsx scripts/verify-host-env.ts` desde la raíz del proyecto
   host antes de compilar — ver la raíz del repo para el script.

## Qué NO hace falta tocar

- El `<provider>` de FileProvider que usa `launchCamera()` — lo aporta
  `react-native-image-picker` vía manifest merging de Gradle.
- Los `<receiver>`/`<service>` de notifee — los aporta el propio paquete.
- Cualquier configuración nativa de `react-native-tts` — usa el motor TTS
  ya instalado del sistema operativo, sin componentes propios (solo
  necesita el `<queries>` ya incluido en el manifest).
