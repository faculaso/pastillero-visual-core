module.exports = {
  presets: ['module:@react-native/babel-preset'],
  // Reanimated 4 delega la compilación de worklets en react-native-worklets —
  // el plugin de reanimated es solo un re-export, pero tiene que ser el ÚLTIMO
  // de la lista (transforma código ya procesado por los demás presets/plugins).
  plugins: ['react-native-reanimated/plugin'],
};
