import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSession } from '../../../providers/SessionContext';
import { AccessibleText } from '../../../design-system/AccessibleText';
import { colors, spacing } from '../../../design-system/tokens';
import { AuthCard } from '../../auth/components/AuthCard';
import { PairingCodeInput } from '../../auth/components/PairingCodeInput';
import { PrimaryAuthButton } from '../../auth/components/PrimaryAuthButton';

function describeLinkError(code: string | undefined): string {
  if (code === 'INVITE_CODE_INVALID') return 'Ese código no es válido. Pedile el código a tu Adulto Mayor y revisá que esté bien escrito.';
  // Posible desde que una misma cuenta puede tener los dos roles: el código
  // propio queda a la vista de alguien que también puede redimir códigos.
  if (code === 'CANNOT_LINK_TO_SELF') return 'Ese es tu propio código. Necesitás el de la persona que vas a cuidar.';
  return 'No pudimos vincular la cuenta. Intentá de nuevo.';
}

export interface LinkPatientPromptProps {
  /** Se llama tras vincular OK. La home de pacientes lo usa para recargar su lista. */
  readonly onLinked?: () => void;
  /** `otro` cambia el texto para quien ya tiene a alguien a cargo y está sumando a otra persona. */
  readonly variant?: 'primero' | 'otro';
}

/**
 * Se muestra en vez del formulario de alta cuando el Cuidador todavía no
 * tiene un paciente vinculado (`session.patientId` vacío) — sin esto,
 * `RegisterTreatmentUseCase` fallaba recién al guardar, con un error de
 * dominio genérico ("patientId vacío") que la pantalla mostraba mal
 * etiquetado como un problema de color/forma. Cortarlo ACÁ, antes de
 * mostrar el formulario, es honesto sobre la causa real.
 *
 * Comparte los mismos componentes de "emparejamiento" que `SignUpScreen`
 * (rol Cuidador) — es el mismo gesto (redimir un invite code), solo que acá
 * el Cuidador ya tiene sesión iniciada.
 */
export function LinkPatientPrompt({ onLinked, variant = 'primero' }: LinkPatientPromptProps): React.JSX.Element {
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
    setStatus('idle');
    setInviteCode('');
    onLinked?.();
  }

  return (
    <View style={styles.container}>
      <AuthCard staggerIndex={0}>
        <AccessibleText variant="title" bold style={styles.centerText}>
          {variant === 'otro' ? 'Sumá a otra persona' : 'Vinculá a tu Adulto Mayor'}
        </AccessibleText>
        <AccessibleText variant="body" color={colors.textSecondary} style={styles.centerText}>
          {variant === 'otro'
            ? 'Pedile su código de invitación y cargalo acá. Después vas a poder elegir a cuál de las dos personas gestionás.'
            : 'Todavía no tenés ningún paciente vinculado a tu cuenta. Pedile el código de invitación y cargalo acá para poder registrar sus tratamientos.'}
        </AccessibleText>

        <PairingCodeInput
          label="Código de invitación"
          value={inviteCode}
          onChangeText={setInviteCode}
          hasError={status === 'error'}
          staggerIndex={1}
        />

        {error ? (
          <AccessibleText color={colors.critical} bold style={styles.centerText}>
            {error}
          </AccessibleText>
        ) : null}

        <PrimaryAuthButton
          label="Vincular"
          onPress={handleSubmit}
          disabled={inviteCode.trim().length === 0 || status === 'submitting'}
          loading={status === 'submitting'}
          staggerIndex={2}
        />
      </AuthCard>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg },
  centerText: { textAlign: 'center' },
});
