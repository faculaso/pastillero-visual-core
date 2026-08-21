import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  checkNodeVersion,
  checkPackageJsonDependencies,
  checkNodeModulesInstalled,
  checkAndroidManifest,
  checkMedicalAlarmAsset,
  checkIndexJsBackgroundHandlerOrder,
  checkEnvVar,
  runAllChecks,
  REQUIRED_NATIVE_DEPENDENCIES,
  REQUIRED_MANIFEST_PERMISSIONS,
} from '../../../scripts/verify-host-env';

describe('checkNodeVersion', () => {
  it('ok si la versión mayor es >= 18', () => {
    expect(checkNodeVersion('v18.0.0').status).toBe('ok');
    expect(checkNodeVersion('v22.22.2').status).toBe('ok');
  });

  it('fail si la versión mayor es < 18', () => {
    expect(checkNodeVersion('v16.20.0').status).toBe('fail');
  });
});

describe('checkEnvVar', () => {
  it('ok si la variable está seteada', () => {
    const result = checkEnvVar('FOO', { FOO: 'bar' });
    expect(result.status).toBe('ok');
    expect(result.detail).toBe('bar');
  });

  it('warn por default si no está seteada', () => {
    const result = checkEnvVar('FOO', {});
    expect(result.status).toBe('warn');
  });

  it('respeta severity fail explícito', () => {
    const result = checkEnvVar('FOO', {}, 'fail');
    expect(result.status).toBe('fail');
  });
});

describe('checks basados en filesystem', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'verify-host-env-test-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  describe('checkPackageJsonDependencies', () => {
    it('fail si no existe package.json', () => {
      expect(checkPackageJsonDependencies(dir).status).toBe('fail');
    });

    it('fail si faltan dependencias nativas requeridas', () => {
      writeFileSync(join(dir, 'package.json'), JSON.stringify({ dependencies: {} }));
      const result = checkPackageJsonDependencies(dir);
      expect(result.status).toBe('fail');
      expect(result.detail).toContain('react-native');
    });

    it('ok si todas las dependencias requeridas están presentes (en dependencies, devDependencies o peerDependencies)', () => {
      const deps: Record<string, string> = {};
      for (const dep of REQUIRED_NATIVE_DEPENDENCIES) deps[dep] = '*';
      writeFileSync(join(dir, 'package.json'), JSON.stringify({ dependencies: deps }));
      expect(checkPackageJsonDependencies(dir).status).toBe('ok');
    });

    it('considera peerDependencies válidas (no solo dependencies/devDependencies)', () => {
      const peerDeps: Record<string, string> = {};
      for (const dep of REQUIRED_NATIVE_DEPENDENCIES) peerDeps[dep] = '*';
      writeFileSync(join(dir, 'package.json'), JSON.stringify({ peerDependencies: peerDeps }));
      expect(checkPackageJsonDependencies(dir).status).toBe('ok');
    });
  });

  describe('checkNodeModulesInstalled', () => {
    it('fail si no existe node_modules', () => {
      expect(checkNodeModulesInstalled(dir).status).toBe('fail');
    });

    it('fail si faltan paquetes nativos instalados', () => {
      mkdirSync(join(dir, 'node_modules'));
      expect(checkNodeModulesInstalled(dir).status).toBe('fail');
    });

    it('ok si todos los paquetes nativos requeridos están instalados', () => {
      for (const dep of REQUIRED_NATIVE_DEPENDENCIES) {
        mkdirSync(join(dir, 'node_modules', dep), { recursive: true });
      }
      expect(checkNodeModulesInstalled(dir).status).toBe('ok');
    });
  });

  describe('checkAndroidManifest', () => {
    const manifestDir = () => join(dir, 'android/app/src/main');

    it('fail si no existe el manifest', () => {
      expect(checkAndroidManifest(dir).status).toBe('fail');
    });

    it('fail si faltan permisos requeridos', () => {
      mkdirSync(manifestDir(), { recursive: true });
      writeFileSync(join(manifestDir(), 'AndroidManifest.xml'), '<manifest></manifest>');
      const result = checkAndroidManifest(dir);
      expect(result.status).toBe('fail');
      expect(result.detail).toContain('POST_NOTIFICATIONS');
    });

    it('ok si todos los permisos requeridos están presentes', () => {
      mkdirSync(manifestDir(), { recursive: true });
      const permissions = REQUIRED_MANIFEST_PERMISSIONS.map(
        (p) => `<uses-permission android:name="${p}" />`,
      ).join('\n');
      writeFileSync(join(manifestDir(), 'AndroidManifest.xml'), `<manifest>${permissions}</manifest>`);
      expect(checkAndroidManifest(dir).status).toBe('ok');
    });
  });

  describe('checkMedicalAlarmAsset', () => {
    it('fail si no existe el archivo de sonido', () => {
      expect(checkMedicalAlarmAsset(dir).status).toBe('fail');
    });

    it('ok si el archivo existe', () => {
      const rawDir = join(dir, 'android/app/src/main/res/raw');
      mkdirSync(rawDir, { recursive: true });
      writeFileSync(join(rawDir, 'medical_alarm.mp3'), 'contenido-falso');
      expect(checkMedicalAlarmAsset(dir).status).toBe('ok');
    });
  });

  describe('checkIndexJsBackgroundHandlerOrder', () => {
    it('fail si no existe index.js', () => {
      expect(checkIndexJsBackgroundHandlerOrder(dir).status).toBe('fail');
    });

    it('fail si index.js no registra onBackgroundEvent', () => {
      writeFileSync(join(dir, 'index.js'), `AppRegistry.registerComponent('App', () => App);`);
      const result = checkIndexJsBackgroundHandlerOrder(dir);
      expect(result.status).toBe('fail');
      expect(result.detail).toContain('onBackgroundEvent');
    });

    it('fail si onBackgroundEvent aparece DESPUÉS de registerComponent (orden incorrecto)', () => {
      writeFileSync(
        join(dir, 'index.js'),
        `AppRegistry.registerComponent('App', () => App);\nnotifee.onBackgroundEvent(handler);`,
      );
      const result = checkIndexJsBackgroundHandlerOrder(dir);
      expect(result.status).toBe('fail');
      expect(result.detail).toContain('DESPUÉS');
    });

    it('ok si onBackgroundEvent aparece ANTES de registerComponent', () => {
      writeFileSync(
        join(dir, 'index.js'),
        `notifee.onBackgroundEvent(handler);\nAppRegistry.registerComponent('App', () => App);`,
      );
      expect(checkIndexJsBackgroundHandlerOrder(dir).status).toBe('ok');
    });
  });

  describe('runAllChecks', () => {
    it('agrega todos los checks individuales en un solo array', () => {
      const results = runAllChecks({ projectRoot: dir, env: {}, nodeVersion: 'v22.0.0' });
      const names = results.map((r) => r.name);
      expect(names).toContain('Versión de Node');
      expect(names).toContain('package.json');
      expect(results.length).toBeGreaterThanOrEqual(8);
    });
  });
});
