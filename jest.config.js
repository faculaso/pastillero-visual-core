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
    'node_modules/(?!(react-native|@react-native|@react-navigation|react-native-screens|react-native-safe-area-context)/)',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
};
