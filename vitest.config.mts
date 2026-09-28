import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      // Vitest no puede parsear el Flow del código fuente de react-native, así
      // que un módulo de presentación que lo importe (p. ej. `tokens.ts`, que
      // lee `Appearance` para resolver claro/oscuro) rompería la suite al
      // importarse. El stub declara sólo lo mínimo y lanza un error con el
      // nombre exacto si se le pide algo más — ver tests/stubs/react-native.ts.
      'react-native': fileURLToPath(new URL('./tests/stubs/react-native.ts', import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // tests/ui (componentes RN, .tsx) y tests/native (servicios que importan
    // react-native de verdad, ej. notifee) van por Jest — ver jest.config.js.
    exclude: ['**/node_modules/**', 'tests/ui/**', 'tests/native/**'],
    coverage: {
      provider: 'v8',
      include: ['src/domain/**', 'src/application/**', 'src/infrastructure/**'],
    },
  },
});
