import React, { useState } from 'react';
import { View, TextInput, StyleSheet } from 'react-native';
import { useSession } from '../../../providers/SessionContext';
import { AccessibleText } from '../../../design-system/AccessibleText';
import { AccessibleButton } from '../../../design-system/AccessibleButton';
import { colors, radii, spacing, touchTarget, typography } from '../../../design-system/tokens';

function describeLinkError(code: string | undefined): string {
  if (code === 'INVITE_CODE_INVALID') return 'Ese código no es válido. Pedile el código a tu Adulto Mayor y revisá que esté bien escrito.';
  return 'No pudimos vincular la cuenta. Intentá de nuevo.';
}

/**
 * Se muestra en vez del formulario de alta cuando el Cuidador todavía no
 * tiene un paciente vinculado (`session.patientId` vacío) — sin esto,
 * `RegisterTreatmentUseCase` fallaba recién al guardar, con un error de
 * dominio genérico ("patientId vacío") que la pantalla mostraba mal
 * etiquetado como un problema de color/forma. Cortarlo ACÁ, antes de
 * mostrar el formulario, es honesto sobre la causa real.
 */
export function LinkPatientPrompt(): React.JSX.Element {
  const { linkPatient } = useSession();
  const [inviteCode, setInviteCode] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(): Promise<void> {
    setStatus('submitting');
    setError(null);

    const result = await linkPatient(inviteCode);
    if (!result.ok) {
      setStatus('error');
      setError(describeLinkError(result.errorCode));
      return;
    }
    // Éxito: `session.patientId` ya se actualizó — `RegisterTreatmentScreen`
    // re-renderiza solo y deja de mostrar este prompt.
    setStatus('idle');
  }

  return (
    <View style={styles.container}>
      <AccessibleText variant="title" bold style={styles.centerText}>
        Vinculá a tu Adulto Mayor
      </AccessibleText>
      <AccessibleText variant="body" color={colors.textSecondary} style={styles.centerText}>
        Todavía no tenés ningún paciente vinculado a tu cuenta. Pedile el código de invitación y cargalo acá para
        poder registrar sus tratamientos.
      </AccessibleText>

      <View style={styles.field}>
        <AccessibleText variant="small" bold color={colors.textSecondary}>
          Código de invitación
        </AccessibleText>
        <TextInput
          style={styles.input}
          value={inviteCode}
          onChangeText={(text) => setInviteCode(text.toUpperCase())}
          placeholder="Ej: 7F2K9M"
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="characters"
          accessibilityLabel="Código de invitación"
        />
      </View>

      {error ? (
        <AccessibleText color={colors.critical} bold style={styles.centerText}>
          {error}
        </AccessibleText>
      ) : null}

      <AccessibleButton
        label="Vincular"
        onPress={handleSubmit}
        disabled={inviteCode.trim().length === 0 || status === 'submitting'}
        loading={status === 'submitting'}
        fullHeight
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.lg, padding: spacing.lg },
  centerText: { textAlign: 'center' },
  field: { gap: spacing.sm },
  input: {
    minHeight: touchTarget.minHeight,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    fontSize: typography.body,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
});
