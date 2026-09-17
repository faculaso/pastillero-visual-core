import React, { useCallback, useState } from 'react';
import { Platform, Pressable, StyleSheet, Vibration, View } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import type { WeekDoseView } from '../../../../application';
import { DoseStatus } from '../../../../domain';
import { PillVisual } from '../../pastillero-virtual/components/PillVisual';
import { AccessibleText } from '../../../design-system/AccessibleText';
import { colors, radii } from '../../../design-system/tokens';

export interface PastilleroCompartmentProps {
  readonly doses: readonly WeekDoseView[];
  readonly label: string;
  readonly isToday: boolean;
  readonly onOpen: () => void;
}

const OPEN_ROTATION_DEG = -115;
const SPRING_OPEN = { damping: 12, stiffness: 160, mass: 0.9 };
const SPRING_CLOSE = { damping: 16, stiffness: 140, mass: 0.9 };
/** Cuánto queda la tapa arriba antes de asentarse — le da tiempo a la hoja de detalle a aparecer detrás. */
const CLOSE_DELAY_MS = 260;

function vibrateLight(): void {
  // `expo-haptics` no aplica: esta app es RN CLI puro (sin `expo-modules-core`
  // instalado), así que agregarlo requeriría meter todo el runtime de Expo
  // solo para esto. `Vibration` es la misma API nativa que ya usa
  // `NativeConfirmationFeedback` en esta base de código — un pulso corto
  // (10ms) es el equivalente más cercano a `ImpactFeedbackStyle.Light` sin
  // dependencias nuevas. Solo en Android, que es el target de este rediseño.
  if (Platform.OS === 'android') {
    Vibration.vibrate(10);
  }
}

/**
 * Un compartimento del pastillero físico: una "tapa" de policarbonato que
 * gira sobre su borde superior (bisagra) al tocar, revelando un pozo cóncavo
 * con las pastillas reales (forma + color) de ese día/turno. La animación
 * corre en el hilo de UI (Reanimated `useAnimatedStyle` + `withSpring`), así
 * que no se traba aunque la app esté ocupada cargando datos en JS.
 *
 * La tapa NO queda sincronizada con el ciclo de vida del modal de detalle
 * (que vive en `CuidadorHomeScreen`, fuera de este árbol) — abrirse y
 * volver a cerrarse sola es el gesto de confirmación táctil; el modal es la
 * superficie real de detalle, y puede quedar abierto más tiempo que la
 * animación sin que se vea raro (la tapa ya asentó "abierta y vuelta a
 * cerrar" como un flip, no como un estado persistente).
 */
export function PastilleroCompartment({ doses, label, isToday, onOpen }: PastilleroCompartmentProps): React.JSX.Element {
  const lidRotation = useSharedValue(0); // 0 = cerrada, 1 = abierta (-115deg)
  const pressScale = useSharedValue(1);
  // El pozo mide ~35-45dp de lado en una grilla de 7 columnas — a ese tamaño,
  // 2-3 pastillitas de 16px lado a lado se ven como puntitos de color, no
  // como su forma real. Se mide el ancho real del pozo (`onLayout`, varía
  // según el dispositivo) y se muestra UNA sola pastilla grande (la primera
  // pendiente), con una placa "+N" para el resto — prioriza que la forma se
  // reconozca por sobre mostrar todas a la vez.
  const [wellSize, setWellSize] = useState(0);

  const handleOpened = useCallback(() => {
    onOpen();
  }, [onOpen]);

  function handlePress(): void {
    vibrateLight();
    pressScale.value = withSpring(0.94, { damping: 10, stiffness: 300 }, () => {
      pressScale.value = withSpring(1, { damping: 10, stiffness: 200 });
    });
    lidRotation.value = withSpring(1, SPRING_OPEN, (finished) => {
      if (finished) {
        runOnJS(handleOpened)();
      }
      lidRotation.value = withDelay(CLOSE_DELAY_MS, withSpring(0, SPRING_CLOSE));
    });
  }

  const lidAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 500 }, { rotateX: `${lidRotation.value * OPEN_ROTATION_DEG}deg` }],
    opacity: 1 - lidRotation.value * 0.15,
  }));

  const trayAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  const hasDoses = doses.length > 0;
  const pendingDoses = doses.filter((d) => d.status !== DoseStatus.TAKEN);
  const allTaken = hasDoses && pendingDoses.length === 0;

  return (
    // Sin `overflow: 'hidden'` en ningún contenedor de este árbol: la tapa
    // gira hasta -115deg (pasa la vertical) y necesita poder "salirse" del
    // rectángulo de la celda sin que Android la recorte.
    <Animated.View style={[styles.wrapper, trayAnimatedStyle]}>
      <Pressable
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={
          // "medicamento(s)" lo lee un lector de pantalla como "medicamento
          // paréntesis ese". El plural se resuelve acá, no con un paréntesis.
          hasDoses
            ? `${label} — ${doses.length} ${doses.length === 1 ? 'medicamento' : 'medicamentos'}`
            : `${label} — sin dosis programadas, tocá para agregar un tratamiento`
        }
        style={styles.pressable}
      >
        <View
          style={[styles.well, isToday && styles.wellToday]}
          onLayout={(e) => setWellSize(e.nativeEvent.layout.width)}
        >
          <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
            <Defs>
              <LinearGradient id="wellShade" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#0F172A" stopOpacity={0.28} />
                <Stop offset="0.25" stopColor="#0F172A" stopOpacity={0.05} />
                <Stop offset="0.75" stopColor="#FFFFFF" stopOpacity={0.08} />
                <Stop offset="1" stopColor="#0F172A" stopOpacity={0.16} />
              </LinearGradient>
            </Defs>
            <Rect x={0} y={0} width="100%" height="100%" rx={radii.sm} fill="url(#wellShade)" />
          </Svg>

          {allTaken ? (
            <AccessibleText variant="small" bold color={colors.success} style={styles.checkMark}>
              ✓
            </AccessibleText>
          ) : pendingDoses.length > 0 && wellSize > 0 ? (
            <View style={styles.pillSlot}>
              <PillVisual visualProfile={pendingDoses[0]!.visualProfile} size={Math.round(wellSize * 0.62)} />
              {pendingDoses.length > 1 ? (
                <View style={styles.overflowBadge}>
                  <AccessibleText variant="small" bold color="#FFFFFF" style={styles.overflowBadgeText}>
                    +{pendingDoses.length - 1}
                  </AccessibleText>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>

        <Animated.View style={[styles.lid, lidAnimatedStyle]} pointerEvents="none">
          <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
            <Defs>
              <LinearGradient id="lidGloss" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.55} />
                <Stop offset="0.35" stopColor="#BAE6FD" stopOpacity={0.22} />
                <Stop offset="0.65" stopColor="#0284C7" stopOpacity={0.18} />
                <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0.12} />
              </LinearGradient>
            </Defs>
            <Rect x={0} y={0} width="100%" height="100%" rx={radii.sm} fill="url(#lidGloss)" />
          </Svg>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, aspectRatio: 1 },
  pressable: { flex: 1 },
  well: {
    flex: 1,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: 'rgba(2, 132, 199, 0.35)',
    backgroundColor: 'rgba(224, 242, 254, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden', // recorta el gradiente SVG a las esquinas redondeadas del pozo — no afecta a la tapa, que es un hermano fuera de este View.
  },
  wellToday: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  lid: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '55%',
    borderTopLeftRadius: radii.sm,
    borderTopRightRadius: radii.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    backgroundColor: 'rgba(186, 230, 253, 0.35)',
    transformOrigin: ['50%', '0%', 0],
  },
  pillSlot: { alignItems: 'center', justifyContent: 'center' },
  overflowBadge: {
    position: 'absolute',
    bottom: -2,
    right: -4,
    minWidth: 14,
    height: 14,
    borderRadius: radii.pill,
    paddingHorizontal: 2,
    backgroundColor: colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overflowBadgeText: { fontSize: 8, lineHeight: 10 },
  checkMark: { fontSize: 13 },
});
