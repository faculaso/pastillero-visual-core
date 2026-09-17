import React, { useEffect, useRef, useState } from 'react';
import {
  ScrollView,
  View,
  StyleSheet,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewInstance,
} from 'react-native';
import type { PendingDoseView } from '../../../../application';
import type { TimeOfDayTheme } from '../../../utils/time-of-day-theme';
import { AccessibleText } from '../../../design-system/AccessibleText';
import { radii, spacing } from '../../../design-system/tokens';
import { CurrentDoseCard } from './CurrentDoseCard';
import { PillboxCompartment } from './PillboxCompartment';

export interface DoseCarouselProps {
  /** Todas las tomas pendientes programadas exactamente a la misma hora que la actual — normalmente una sola. */
  readonly doses: readonly PendingDoseView[];
  readonly celebrationTrigger: number;
  readonly index: number;
  readonly onIndexChange: (index: number) => void;
  /** El hint y los dots se dibujan sobre el fondo teñido por turno, no sobre
   * la tarjeta blanca — necesitan los colores del tema o quedan ilegibles de
   * noche (`colors.textSecondary` sobre el índigo da ~1.4:1). */
  readonly theme: TimeOfDayTheme;
}

/**
 * Dos (o más) medicamentos a la misma hora comparten turno, pero
 * `PillboxCompartment`/`CurrentDoseCard` solo muestran una toma por vez —
 * en vez de listarlas apiladas (obliga a scrollear una tarjeta grande
 * arriba de otra) se navega deslizando horizontalmente, una tapita de
 * pastillero por toma, igual que pasar la página de un pastillero físico.
 * Con una sola toma en el grupo (el caso normal) esto se comporta como el
 * `PillboxCompartment` de siempre — sin puntos ni pista de deslizar.
 */
export function DoseCarousel({
  doses,
  celebrationTrigger,
  index,
  onIndexChange,
  theme,
}: DoseCarouselProps): React.JSX.Element {
  const [pageWidth, setPageWidth] = useState(0);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const hasMultiple = doses.length > 1;

  // Sincroniza el scroll físico con `index` cuando cambia por una causa
  // EXTERNA (se confirmó la toma que se estaba viendo y el grupo se
  // achicó) — si el cambio vino del propio gesto de deslizar, `index` ya
  // coincide con la posición actual, así que este `scrollTo` es un no-op.
  useEffect(() => {
    if (pageWidth > 0) {
      scrollRef.current?.scrollTo({ x: index * pageWidth, animated: false });
    }
  }, [index, pageWidth]);

  function handleLayout(event: LayoutChangeEvent): void {
    setPageWidth(event.nativeEvent.layout.width);
  }

  function handleMomentumScrollEnd(event: NativeSyntheticEvent<NativeScrollEvent>): void {
    if (pageWidth <= 0) return;
    const newIndex = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
    if (newIndex !== index) onIndexChange(newIndex);
  }

  return (
    <View>
      {/* Hint y dots van JUNTOS y ARRIBA de la tarjeta: con los dots abajo
          quedaban fuera de pantalla (la tarjeta suele exceder el alto útil),
          separados del texto que los explica. Juntos se leen como una sola
          idea — "hay 2 pastillas acá, estás en la 1". */}
      {hasMultiple ? (
        <View style={styles.pager}>
          <AccessibleText variant="small" color={theme.mutedText} style={styles.hint}>
            Deslizá para ver la otra pastilla de este turno
          </AccessibleText>
          <View style={styles.dots} accessible accessibilityLabel={`Pastilla ${index + 1} de ${doses.length}`}>
            {doses.map((dose, dotIndex) =>
              dotIndex === index ? (
                <View key={dose.doseId} style={[styles.dot, styles.dotActive, { backgroundColor: theme.accentText }]} />
              ) : (
                // El inactivo se distingue por FORMA (círculo hueco y angosto
                // vs. cápsula rellena), no solo por color — el activo/inactivo
                // no puede depender de un cambio cromático que un usuario con
                // baja visión o daltonismo no llegue a percibir.
                <View key={dose.doseId} style={[styles.dot, styles.dotInactive, { borderColor: theme.mutedText }]} />
              ),
            )}
          </View>
        </View>
      ) : null}
      <View onLayout={handleLayout}>
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          scrollEnabled={hasMultiple}
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleMomentumScrollEnd}
          accessibilityRole={hasMultiple ? 'adjustable' : undefined}
        >
          {doses.map((dose) => (
            <View key={dose.doseId} style={{ width: pageWidth }}>
              <PillboxCompartment doseId={dose.doseId} celebrationTrigger={celebrationTrigger}>
                <CurrentDoseCard dose={dose} />
              </PillboxCompartment>
            </View>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pager: { alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  hint: { textAlign: 'center' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm },
  dot: {
    width: 10,
    height: 10,
    borderRadius: radii.pill,
  },
  dotActive: {
    width: 26,
  },
  dotInactive: {
    backgroundColor: 'transparent',
    borderWidth: 2,
  },
});
