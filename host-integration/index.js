/**
 * host-integration/index.js
 *
 * Reemplaza al `index.js` del proyecto host generado por
 * `npx @react-native-community/cli init` (o Expo bare). Es el ÚNICO lugar
 * donde `notifee.onBackgroundEvent` puede registrarse de forma confiable:
 * antes de `AppRegistry.registerComponent`, fuera de cualquier árbol de
 * React — un evento de background puede llegar con la app completamente
 * cerrada, en cuyo caso RN levanta un contexto headless nuevo sin ningún
 * componente montado.
 *
 * @format
 */

import { AppRegistry } from 'react-native';
import notifee from '@notifee/react-native';
import App from './src/presentation/App';
import { bootstrap } from './src/infrastructure/bootstrap';
import { createBackgroundEventHandler } from './src/infrastructure/services/notifee/notifee-notification-scheduler';
import { name as appName } from './app.json';

/**
 * `createBackgroundEventHandler` recibe una FACTORY, no una instancia ya
 * construida: si el proceso estaba completamente matado, no hay ningún
 * `ConfirmDoseUseCase` "vivo" al que engancharse — el handler hace su
 * propio `bootstrap()` liviano (abre SQLite, corre migraciones) recién
 * cuando el evento efectivamente lo necesita (acción "Confirmar Toma";
 * "Posponer 15 min" no lo toca, ver el docblock de la función).
 */
notifee.onBackgroundEvent(
  createBackgroundEventHandler(async () => (await bootstrap()).confirmDose),
);

AppRegistry.registerComponent(appName, () => App);
