import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // tests/ui (componentes RN, .tsx) y tests/native (servicios que importan
    // react-native de verdad, ej. notifee) van por Jest — ver jest.config.js.
    // Vitest no puede parsear el Flow que trae el código fuente de react-native.
    exclude: ['**/node_modules/**', 'tests/ui/**', 'tests/native/**'],
    coverage: {
      provider: 'v8',
      include: ['src/domain/**', 'src/application/**', 'src/infrastructure/**'],
    },
  },
});
