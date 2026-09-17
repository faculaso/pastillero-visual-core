import React from 'react';
import { View, StyleSheet } from 'react-native';
import type { PendingDoseView } from '../../../../application';
import { AccessibleText } from '../../../design-system/AccessibleText';
import { colors, radii, spacing, shadows } from '../../../design-system/tokens';
import { PillVisual } from './PillVisual';
import { VoiceGuidanceButton } from './VoiceGuidanceButton';
import { buildDoseVoiceMessage } from '../voice-message';

export interface CurrentDoseCardProps {
  readonly dose: PendingDoseView;
}

export function formatDosage(dose: PendingDoseView): string {
  const { amount, unit } = dose.dosagePerTake;
  // Solo `UNIT` se pluraliza; "mg"/"ml" son símbolos, invariables en español.
  const label = unit === 'UNIT' ? (amount === 1 ? 'comprimido' : 'comprimidos') : unit.toLowerCase();
  return `${amount} ${label}`;
}

/**
 * CU-02 paso 3: "El sistema renderiza el pastillero del turno mostrando la
 * forma/color del comprimido y la foto de la caja". Esta tarjeta es SIEMPRE
 * blanca sobre el fondo teñido por turno (ese tinte lo aplica
 * `PastilleroVirtualScreen`, no esta tarjeta) — mismo criterio que el
 * mockup de referencia: el "showcase" del comprimido necesita contraste
 * neutro constante para que el color/forma real se lea bien sin importar
 * si es de mañana, tarde o noche.
 */
export function CurrentDoseCard({ dose }: CurrentDoseCardProps): React.JSX.Element {
  return (
    <View style={styles.card} accessible accessibilityRole="summary">
      <View style={[styles.showcase, shadows.pillShowcase]}>
        <View style={styles.showcaseHeader}>
          <View style={styles.showcaseTag}>
            <AccessibleText variant="small" color="#FFFFFF" bold style={styles.showcaseTagText}>
              Así se ve tu pastilla
            </AccessibleText>
          </View>
          {dose.visualProfile.slotLabel ? (
            <View style={styles.slotChip}>
              {/* Dos líneas como techo: el catálogo de ANMAT trae
                  concentraciones de hasta ~50 caracteres (radiofármacos,
                  combinaciones) que si no se acotan empujan el rótulo y se
                  comen el showcase del comprimido, que es lo que la persona
                  vino a mirar. El valor completo no se pierde: lo lee
                  "Escuchar indicaciones". */}
              <AccessibleText
                variant="small"
                bold
                color={colors.textSecondary}
                numberOfLines={2}
                accessibilityLabel={dose.visualProfile.slotLabel}
              >
                {dose.visualProfile.slotLabel}
              </AccessibleText>
            </View>
          ) : null}
        </View>
        <View style={styles.showcasePillSlot}>
          <PillVisual visualProfile={dose.visualProfile} size={170} medicationName={dose.medicationName} />
        </View>
      </View>

      <AccessibleText variant="display" bold color={colors.textPrimary} style={styles.medicationName}>
        {dose.medicationName}
      </AccessibleText>

      <AccessibleText variant="body" color={colors.textSecondary} style={styles.dosageText}>
        {formatDosage(dose)}
      </AccessibleText>

      <VoiceGuidanceButton text={buildDoseVoiceMessage(dose)} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.md,
    ...shadows.card,
  },
  showcase: {
    width: '100%',
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.md,
  },
  showcaseHeader: {
    // Fluye ANTES del comprimido (no superpuesto como esquina absoluta) —
    // con formas altas (p. ej. `PillShape.OTHER`, un hexágono) el pill
    // centrado verticalmente quedaba a solo unos px del rótulo "flotante"
    // en la esquina, y en algunos anchos de pantalla llegaban a pisarse.
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  slotChip: {
    // `slotLabel` ANTES solo se insinuaba con un puntito azul vacío en la
    // esquina del comprimido: se leía como un radio button (invita a
    // tocarlo) y no decía absolutamente nada. Si el dato existe hay que
    // mostrarlo — la voz de `buildDoseVoiceMessage` ya lo lee en voz alta.
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    // Nunca más de la mitad de la fila: el rótulo "Así se ve tu pastilla"
    // tiene prioridad, este chip es dato de referencia.
    maxWidth: '50%',
  },
  showcaseTag: {
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.sm,
  },
  showcasePillSlot: {
    width: '100%',
    alignItems: 'center',
  },
  showcaseTagText: {
    letterSpacing: 0.5,
  },
  medicationName: {
    textAlign: 'center',
  },
  dosageText: {
    textAlign: 'center',
  },
});
