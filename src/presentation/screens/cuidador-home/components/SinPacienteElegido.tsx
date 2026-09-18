import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AccessibleText } from '../../../design-system/AccessibleText';
import { AccessibleButton } from '../../../design-system/AccessibleButton';
import { colors, spacing } from '../../../design-system/tokens';

export interface SinPacienteElegidoProps {
  readonly onVolver: () => void;
}

/**
 * Reemplaza al `LinkPatientPrompt` que mostraban estas pantallas cuando
 * `session.patientId` venía vacío.
 *
 * Desde que la raíz del stack es `MisPacientes`, "no hay paciente" dejó de
 * significar "esta cuenta no vinculó a nadie" y pasa a significar "todavía
 * no elegiste a cuál de tus pacientes gestionás". Ofrecer acá un campo para
 * pegar un código de invitación sería contestar una pregunta que nadie hizo.
 */
export function SinPacienteElegido({ onVolver }: SinPacienteElegidoProps): React.JSX.Element {
  return (
    <View style={styles.container}>
      <AccessibleText variant="title" bold style={styles.centerText}>
        Elegí a quién gestionás
      </AccessibleText>
      <AccessibleText variant="body" color={colors.textSecondary} style={styles.centerText}>
        Volvé a la lista y tocá el nombre de la persona cuyos tratamientos querés ver.
      </AccessibleText>
      <AccessibleButton label="Ver a quiénes cuido" onPress={onVolver} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: spacing.lg, gap: spacing.md },
  centerText: { textAlign: 'center' },
});
