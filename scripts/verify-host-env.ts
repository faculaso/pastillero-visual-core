#!/usr/bin/env node
/**
 * scripts/verify-host-env.ts
 *
 * Preflight que corre en la RAÍZ del proyecto HOST de React Native (no en
 * este Core) — después de copiar `src/` y los artefactos de
 * `host-integration/`, ANTES de compilar. Chequea que las piezas nativas
 * que este Core necesita (SQLite, notifee, fotos, TTS) estén realmente
 * en su lugar, en vez de descubrirlo con un crash en el dispositivo.
 *
 * Uso:
 *   npx tsx scripts/verify-host-env.ts [--project-root <path>]
 *
 * Corrido sin `--project-root`, asume el directorio actual. Si corrés
 * esto DENTRO de este Core (no del host), vas a ver fallas esperables
 * (`android/`, `index.js` no existen acá) — es información correcta: eso
 * es justamente lo que falta si este fuera el host.
 *
 * Exit code 1 si hay algún check en estado `fail`; los `warn` no bloquean.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export type CheckStatus = 'ok' | 'warn' | 'fail';

export interface CheckResult {
  readonly name: string;
  readonly status: CheckStatus;
  readonly detail: string;
}

export const REQUIRED_NATIVE_DEPENDENCIES = [
  '@op-engineering/op-sqlite',
  '@notifee/react-native',
  'react-native-fs',
  'react-native-image-picker',
  'react-native-tts',
  '@react-navigation/native',
  '@react-navigation/native-stack',
  'react-native-screens',
  'react-native-safe-area-context',
  'zustand',
  'react',
  'react-native',
] as const;

export const REQUIRED_MANIFEST_PERMISSIONS = [
  'android.permission.POST_NOTIFICATIONS',
  'android.permission.SCHEDULE_EXACT_ALARM',
  'android.permission.USE_FULL_SCREEN_INTENT',
  'android.permission.VIBRATE',
  'android.permission.CAMERA',
  'android.permission.READ_MEDIA_IMAGES',
] as const;

const RES_DIR = 'android/app/src/main/res';
/**
 * `notifee-notification-scheduler.ts` pide este ícono POR NOMBRE
 * (`smallIcon: 'ic_notification'`). Sin él Android no degrada: rechaza la
 * notificación entera con "Invalid notification (no valid small icon)" y no
 * muestra NADA. La alarma dispara puntual, el log tiene el error, y el
 * Adulto Mayor no se entera de que le toca la pastilla.
 */
const NOTIFICATION_ICON_NAME = 'ic_notification';

/**
 * La alarma de toma se muestra con `fullScreenAction`. Sin estos dos
 * atributos en la activity, el intent de pantalla completa **degrada a una
 * notificación normal con el teléfono bloqueado** — que es justo cuando la
 * persona duerme y la alarma tiene que despertarla. No falla nada ni avisa:
 * simplemente no toma la pantalla.
 */
const FULL_SCREEN_ACTIVITY_ATTRS = ['android:showWhenLocked="true"', 'android:turnScreenOn="true"'] as const;
/**
 * Subcarpeta `custom/` OBLIGATORIA: es el `path` por defecto de
 * `moveAssetsDatabase` en op-sqlite. Fuera de ahí no tira excepción —
 * resuelve `false` en silencio, y `bootstrap` se lo come sin ruido. El
 * síntoma es una app que abre perfecto con CERO medicamentos para buscar.
 */
const CATALOG_ASSET_PATH = 'android/app/src/main/assets/custom/pastillero-catalog.db';
const ANDROID_MANIFEST_PATH = 'android/app/src/main/AndroidManifest.xml';
const INDEX_JS_PATH = 'index.js';
const MINIMUM_NODE_MAJOR = 18;

// ---------------------------------------------------------------------
// Checks — funciones puras (path + contenido adentro, sin process.exit)
// ---------------------------------------------------------------------

export function checkNodeVersion(nodeVersion: string): CheckResult {
  const major = Number(nodeVersion.replace(/^v/, '').split('.')[0]);
  if (Number.isFinite(major) && major >= MINIMUM_NODE_MAJOR) {
    return { name: 'Versión de Node', status: 'ok', detail: nodeVersion };
  }
  return {
    name: 'Versión de Node',
    status: 'fail',
    detail: `${nodeVersion} — se requiere >= ${MINIMUM_NODE_MAJOR}`,
  };
}

export function checkPackageJsonDependencies(projectRoot: string): CheckResult {
  const packageJsonPath = join(projectRoot, 'package.json');
  if (!existsSync(packageJsonPath)) {
    return { name: 'package.json', status: 'fail', detail: `No se encontró ${packageJsonPath}` };
  }

  let pkg: {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
  };
  try {
    pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
  } catch (cause) {
    return { name: 'package.json', status: 'fail', detail: `No se pudo parsear: ${String(cause)}` };
  }

  const allDeps = { ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies };
  const missing = REQUIRED_NATIVE_DEPENDENCIES.filter((dep) => !allDeps[dep]);

  if (missing.length === 0) {
    return { name: 'Dependencias nativas en package.json', status: 'ok', detail: 'Todas presentes' };
  }
  return {
    name: 'Dependencias nativas en package.json',
    status: 'fail',
    detail: `Faltan: ${missing.join(', ')}`,
  };
}

export function checkNodeModulesInstalled(projectRoot: string): CheckResult {
  const nodeModulesPath = join(projectRoot, 'node_modules');
  if (!existsSync(nodeModulesPath)) {
    return { name: 'node_modules', status: 'fail', detail: 'No existe — correr npm install' };
  }

  const missing = REQUIRED_NATIVE_DEPENDENCIES.filter((dep) => !existsSync(join(nodeModulesPath, dep)));
  if (missing.length === 0) {
    return { name: 'Módulos nativos instalados', status: 'ok', detail: 'Todos presentes en node_modules' };
  }
  return {
    name: 'Módulos nativos instalados',
    status: 'fail',
    detail: `No instalados: ${missing.join(', ')} — correr npm install`,
  };
}

export function checkAndroidManifest(projectRoot: string): CheckResult {
  const manifestPath = join(projectRoot, ANDROID_MANIFEST_PATH);
  if (!existsSync(manifestPath)) {
    return {
      name: 'AndroidManifest.xml',
      status: 'fail',
      detail: `No se encontró ${ANDROID_MANIFEST_PATH} — copiar host-integration/AndroidManifest.xml`,
    };
  }

  const content = readFileSync(manifestPath, 'utf-8');
  const missing = REQUIRED_MANIFEST_PERMISSIONS.filter((permission) => !content.includes(permission));

  if (missing.length === 0) {
    return { name: 'AndroidManifest.xml', status: 'ok', detail: 'Todos los permisos requeridos presentes' };
  }
  return {
    name: 'AndroidManifest.xml',
    status: 'fail',
    detail: `Faltan permisos: ${missing.join(', ')}`,
  };
}

/**
 * Busca `ic_notification.*` en cualquier `res/drawable*` o `res/mipmap*`:
 * sirve igual como vector XML o como PNG por densidad, y el nombre de la
 * carpeta depende de cuál se haya elegido.
 */
export function checkNotificationIcon(projectRoot: string): CheckResult {
  const resDir = join(projectRoot, RES_DIR);
  const name = 'Ícono de notificación';
  if (!existsSync(resDir)) {
    return { name, status: 'fail', detail: `No se encontró ${RES_DIR}` };
  }

  const carpetas = readdirSync(resDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && (e.name.startsWith('drawable') || e.name.startsWith('mipmap')))
    .map((e) => e.name);

  for (const carpeta of carpetas) {
    const encontrado = readdirSync(join(resDir, carpeta)).find(
      (archivo) => archivo.replace(/\.[^.]+$/, '') === NOTIFICATION_ICON_NAME,
    );
    if (encontrado) {
      return { name, status: 'ok', detail: `${RES_DIR}/${carpeta}/${encontrado}` };
    }
  }

  return {
    name,
    status: 'fail',
    detail: `No se encontró ${NOTIFICATION_ICON_NAME} en ${RES_DIR}/drawable* — Android rechaza TODA notificación sin small icon válido y no se muestra ninguna alarma de toma`,
  };
}

export function checkFullScreenAlarmAttributes(projectRoot: string): CheckResult {
  const name = 'Alarma a pantalla completa';
  const manifestPath = join(projectRoot, ANDROID_MANIFEST_PATH);
  if (!existsSync(manifestPath)) {
    return { name, status: 'fail', detail: `No se encontró ${ANDROID_MANIFEST_PATH}` };
  }

  const content = readFileSync(manifestPath, 'utf-8');
  const missing = FULL_SCREEN_ACTIVITY_ATTRS.filter((attr) => !content.includes(attr));
  if (missing.length === 0) {
    return { name, status: 'ok', detail: 'showWhenLocked + turnScreenOn presentes' };
  }
  return {
    name,
    status: 'fail',
    detail: `Faltan en la activity: ${missing.join(', ')} — con el teléfono bloqueado la alarma no toma la pantalla`,
  };
}

export function checkBundledCatalogAsset(projectRoot: string): CheckResult {
  const assetPath = join(projectRoot, CATALOG_ASSET_PATH);
  if (existsSync(assetPath)) {
    return { name: 'Catálogo ANMAT embebido', status: 'ok', detail: CATALOG_ASSET_PATH };
  }
  return {
    name: 'Catálogo ANMAT embebido',
    status: 'fail',
    detail: `No se encontró ${CATALOG_ASSET_PATH} — la app arranca igual, pero sin NINGÚN medicamento para buscar`,
  };
}

/**
 * Heurística de orden: `onBackgroundEvent` tiene que aparecer ANTES que
 * `AppRegistry.registerComponent` en el archivo — no valida que el
 * registro sea semánticamente correcto (eso requeriría parsear JS de
 * verdad), pero atrapa el error más común: copiar el snippet en el orden
 * equivocado.
 */
export function checkIndexJsBackgroundHandlerOrder(projectRoot: string): CheckResult {
  const indexPath = join(projectRoot, INDEX_JS_PATH);
  if (!existsSync(indexPath)) {
    return {
      name: 'index.js',
      status: 'fail',
      detail: `No se encontró ${INDEX_JS_PATH} — copiar host-integration/index.js`,
    };
  }

  const content = readFileSync(indexPath, 'utf-8');
  const backgroundEventIndex = content.indexOf('onBackgroundEvent');
  const registerComponentIndex = content.indexOf('registerComponent');

  if (backgroundEventIndex === -1) {
    return {
      name: 'index.js — onBackgroundEvent',
      status: 'fail',
      detail: 'No se encontró notifee.onBackgroundEvent(...) — las acciones de notificación en background no van a funcionar con la app cerrada',
    };
  }
  if (registerComponentIndex === -1) {
    return {
      name: 'index.js — AppRegistry',
      status: 'warn',
      detail: 'No se encontró AppRegistry.registerComponent — ¿es realmente el entry point?',
    };
  }
  if (backgroundEventIndex > registerComponentIndex) {
    return {
      name: 'index.js — orden de registro',
      status: 'fail',
      detail: 'onBackgroundEvent aparece DESPUÉS de registerComponent — debe ir antes, o notifee puede no entregar eventos con la app cerrada',
    };
  }

  return {
    name: 'index.js — orden de registro',
    status: 'ok',
    detail: 'onBackgroundEvent se registra antes de AppRegistry.registerComponent',
  };
}

export function checkEnvVar(name: string, env: NodeJS.ProcessEnv, severity: 'warn' | 'fail' = 'warn'): CheckResult {
  const value = env[name];
  if (value) {
    return { name: `Variable de entorno ${name}`, status: 'ok', detail: value };
  }
  return {
    name: `Variable de entorno ${name}`,
    status: severity,
    detail: 'No configurada — necesaria para builds nativos de Android',
  };
}

export interface RunChecksOptions {
  readonly projectRoot: string;
  readonly env: NodeJS.ProcessEnv;
  readonly nodeVersion: string;
}

export function runAllChecks(options: RunChecksOptions): readonly CheckResult[] {
  return [
    checkNodeVersion(options.nodeVersion),
    checkPackageJsonDependencies(options.projectRoot),
    checkNodeModulesInstalled(options.projectRoot),
    checkAndroidManifest(options.projectRoot),
    checkNotificationIcon(options.projectRoot),
    checkFullScreenAlarmAttributes(options.projectRoot),
    checkBundledCatalogAsset(options.projectRoot),
    checkIndexJsBackgroundHandlerOrder(options.projectRoot),
    checkEnvVar('ANDROID_HOME', options.env),
    checkEnvVar('JAVA_HOME', options.env),
  ];
}

// ---------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------

function parseProjectRoot(argv: readonly string[]): string {
  const index = argv.indexOf('--project-root');
  return index >= 0 && argv[index + 1] ? argv[index + 1]! : process.cwd();
}

const STATUS_ICON: Record<CheckStatus, string> = { ok: '✓', warn: '⚠', fail: '✗' };

function printResults(results: readonly CheckResult[]): void {
  console.log('\n— Verificación del entorno host —\n');
  for (const result of results) {
    console.log(`  ${STATUS_ICON[result.status]} ${result.name}: ${result.detail}`);
  }
  const failCount = results.filter((r) => r.status === 'fail').length;
  const warnCount = results.filter((r) => r.status === 'warn').length;
  console.log(`\n  ${failCount} error(es), ${warnCount} advertencia(s)\n`);
}

function main(): void {
  const projectRoot = parseProjectRoot(process.argv.slice(2));
  const results = runAllChecks({ projectRoot, env: process.env, nodeVersion: process.version });
  printResults(results);

  if (results.some((r) => r.status === 'fail')) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}
