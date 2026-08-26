/**
 * Mock manual de Reanimated para Jest. El mock oficial del paquete
 * (`react-native-reanimated/mock`) reexporta utilidades desde el índice
 * real, que a su vez intenta inicializar el runtime nativo de Worklets —
 * revienta bajo Jest incluso por la rama "web" ("createShareable is not
 * supported on web"). Este mock implementa solo el subconjunto que usa
 * `PastilleroCompartment` (el pastillero animado de `WeekGrid`), de forma
 * síncrona: no hay hilo de UI real en los tests, así que las animaciones
 * simplemente saltan al valor final e invocan sus callbacks al toque.
 */
const React = require('react');
const RN = require('react-native');

function useSharedValue(initial) {
  const ref = React.useRef({ value: initial });
  return ref.current;
}

function useAnimatedStyle(factory) {
  return factory();
}

function withSpring(toValue, _config, callback) {
  callback?.(true);
  return toValue;
}

function withTiming(toValue, _config, callback) {
  callback?.(true);
  return toValue;
}

function withDelay(_delayMs, nextAnimation) {
  return nextAnimation;
}

function withSequence(...animations) {
  return animations[animations.length - 1];
}

function runOnJS(fn) {
  return fn;
}

function runOnUI(fn) {
  return fn;
}

const Easing = {
  linear: (t) => t,
  ease: (t) => t,
  bezier: () => (t) => t,
  in: (fn) => fn,
  out: (fn) => fn,
  inOut: (fn) => fn,
};

function interpolate(value) {
  return value;
}

const Animated = {
  View: RN.View,
  Text: RN.Text,
  Image: RN.Image,
  ScrollView: RN.ScrollView,
  createAnimatedComponent: (Component) => Component,
};

module.exports = {
  __esModule: true,
  default: Animated,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  withSequence,
  runOnJS,
  runOnUI,
  Easing,
  interpolate,
};
