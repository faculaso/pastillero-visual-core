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
import { AccessibleText } from '../../../design-system/AccessibleText';
import { colors, radii, spacing } from '../../../design-system/tokens';
import { CurrentDoseCard } from './CurrentDoseCard';
import { PillboxCompartment } from './PillboxCompartment';

export interface DoseCarouselProps {
  /** Todas las tomas pendientes programadas exactamente a la misma hora que la actual — normalmente una sola. */
  readonly doses: readonly PendingDoseView[];
  readonly celebrationTrigger: number;
  readonly index: number;
  readonly onIndexChange: (index: number) => void;
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
export function DoseCarousel({ doses, celebrationTrigger, index, onIndexChange }: DoseCarouselProps): React.JSX.Element {
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
      {hasMultiple ? (
        <AccessibleText variant="small" color={colors.textSecondary} style={styles.hint}>
          👉 Deslizá para ver la otra pastilla de este turno
        </AccessibleText>
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
      {hasMultiple ? (
        <View style={styles.dots} accessible accessibilityLabel={`Pastilla ${index + 1} de ${doses.length}`}>
          {doses.map((dose, dotIndex) => (
            <View key={dose.doseId} style={[styles.dot, dotIndex === index && styles.dotActive]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hint: { textAlign: 'center', marginBottom: spacing.sm },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.md },
  dot: {
    width: 10,
    height: 10,
    borderRadius: radii.pill,
    backgroundColor: colors.border,
  },
  dotActive: {
    backgroundColor: colors.primary,
    width: 26,
  },
});
