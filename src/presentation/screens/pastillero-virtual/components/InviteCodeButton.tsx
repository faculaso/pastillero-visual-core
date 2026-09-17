import React, { useState } from 'react';
import { View, Modal, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { useUseCases } from '../../../providers/UseCasesProvider';
import { AccessibleText } from '../../../design-system/AccessibleText';
import { AccessibleButton } from '../../../design-system/AccessibleButton';
import { colors, radii, spacing, shadows, touchTarget } from '../../../design-system/tokens';
import type { TimeOfDayTheme } from '../../../utils/time-of-day-theme';

export interface InviteCodeButtonProps {
  readonly patientId: string;
  /** Tema del turno: el botón vive sobre el fondo teñido, no sobre una tarjeta blanca. */
  readonly theme?: TimeOfDayTheme | null;
}

type CodeStatus = 'idle' | 'loading' | 'shown' | 'error';

/**
 * El único lugar donde el Adulto Mayor veía su código de invitación era la
 * pantalla de alta, justo después de crear la cuenta (`SignUpScreen`) — una
 * revelación de una sola vez. Si cerró esa pantalla sin anotarlo (o el
 * Cuidador recién se va a registrar más tarde), no había forma de volver a
 * verlo. Este botón lo re-consulta on-demand vía `getProfile` (mismo campo
 * `Profile.inviteCode` que ya expone ese use case).
 */
export function InviteCodeButton({ patientId, theme }: InviteCodeButtonProps): React.JSX.Element {
  const { getProfile } = useUseCases();
  const [status, setStatus] = useState<CodeStatus>('idle');
  const [code, setCode] = useState<string | null>(null);

  async function handlePress(): Promise<void> {
    setStatus('loading');
    const result = await getProfile.execute({ userId: patientId });
    if (!result.ok || !result.value.profile?.inviteCode) {
      setStatus('error');
      return;
    }
    setCode(result.value.profile.inviteCode);
    setStatus('shown');
  }

  function handleClose(): void {
    setStatus('idle');
  }

  return (
    <>
      <Pressable
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel="Ver mi código de invitación"
        hitSlop={8}
        style={({ pressed }) => [
          styles.button,
          theme ? { backgroundColor: theme.chipBackground, borderColor: theme.chipBorder } : null,
          pressed && styles.buttonPressed,
        ]}
      >
        <AccessibleText variant="small" bold color={theme?.accentText ?? colors.textSecondary}>
          Mi código
        </AccessibleText>
      </Pressable>

      <Modal visible={status !== 'idle'} transparent animationType="fade" onRequestClose={handleClose}>
        <View style={styles.overlay}>
          <View style={styles.card}>
            {status === 'loading' ? (
              <ActivityIndicator size="large" color={colors.primary} />
            ) : status === 'shown' && code ? (
              <>
                <AccessibleText variant="title" bold style={styles.centerText}>
                  Tu código de invitación
                </AccessibleText>
                <AccessibleText variant="body" color={colors.textSecondary} style={styles.centerText}>
                  Compartíselo a tu Cuidador para que pueda ver y registrar tus tratamientos.
                </AccessibleText>
                <View style={styles.codeBox}>
                  <AccessibleText variant="display" bold color={colors.primaryDark}>
                    {code}
                  </AccessibleText>
                </View>
              </>
            ) : (
              <AccessibleText variant="body" color={colors.critical} style={styles.centerText}>
                No pudimos obtener tu código. Intentá de nuevo.
              </AccessibleText>
            )}

            {status !== 'loading' ? <AccessibleButton label="Cerrar" variant="secondary" onPress={handleClose} /> : null}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    // El target de 72px ya existía, pero era INVISIBLE: tres rótulos de
    // texto flotando dejaban una banda vacía arriba de la pantalla que se
    // leía como un error de layout, y nada indicaba dónde tocar. Con
    // superficie propia la misma altura pasa a leerse como una botonera.
    flex: 1,
    minHeight: touchTarget.minHeight,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  buttonPressed: {
    backgroundColor: 'rgba(15, 23, 42, 0.06)',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.md,
    ...shadows.card,
  },
  centerText: { textAlign: 'center' },
  codeBox: {
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
    borderRadius: radii.xl,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
});
