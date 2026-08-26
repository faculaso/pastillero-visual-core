/** Config separada de Vitest: para todo lo que importe `react-native` de
 *  verdad (componentes en tests/ui, o servicios nativos como notifee en
 *  tests/native). Vitest sigue siendo el runner para dominio/aplicación/
 *  infraestructura SQLite (tests/unit, tests/integration) — ver
 *  justificación en el chat: el código fuente de `react-native` usa
 *  sintaxis Flow que requiere el transform de Babel/Metro, no soportado
 *  por el parser de Vitest (esbuild/rolldown).
 */
module.exports = {
  preset: '@react-native/jest-preset',
  testMatch: ['<rootDir>/tests/ui/**/*.test.tsx', '<rootDir>/tests/native/**/*.test.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-navigation|react-native-screens|react-native-safe-area-context|react-native-reanimated|react-native-worklets)/)',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  // El módulo nativo de Reanimated/Worklets no existe bajo Jest. El mock
  // oficial del paquete (`react-native-reanimated/mock`) termina igual
  // importando su índice real para reexportar un puñado de utilidades, y
  // ESE índice sí intenta inicializar el runtime nativo — revienta incluso
  // por la rama "web" (`createShareable is not supported on web`). Se
  // reemplaza directo por un mock propio, minimal, en `__mocks__/` (Jest lo
  // toma solo por convención para paquetes de node_modules).
};
