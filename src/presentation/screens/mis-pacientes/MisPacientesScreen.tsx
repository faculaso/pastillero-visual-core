import React, { useCallback, useState } from 'react';
import { View, ScrollView, ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CuidadorStackParamList } from '../../navigation/types';
import type { LinkedPatient } from '../../../domain';
import { useUseCases } from '../../providers/UseCasesProvider';
import { useSession } from '../../providers/SessionContext';
import { AccessibleText } from '../../design-system/AccessibleText';
import { AccessibleButton } from '../../design-system/AccessibleButton';
import { colors, radii, spacing, shadows, touchTarget } from '../../design-system/tokens';
import { LinkPatientPrompt } from '../register-treatment/components/LinkPatientPrompt';

type Props = NativeStackScreenProps<CuidadorStackParamList, 'MisPacientes'>;

type ScreenStatus = 'loading' | 'ready' | 'error';

function nombreDe(patient: LinkedPatient): string {
  return patient.displayName?.trim() || 'Paciente sin nombre';
}

/**
 * Nueva raíz del `CuidadorStack`.
 *
 * Antes la sesión elegía sola el primer vínculo y el Cuidador entraba
 * directo a la semana de esa persona. Con dos o más a cargo eso no era un
 * atajo: los demás pacientes existían en la base y eran invisibles, sin
 * ningún aviso de que estaban ahí. Acá se elige a quién se gestiona, y esa
 * elección vive en la sesión (`selectPatient`) para que el resto del stack
 * —semana, alta de tratamiento, adherencia— siga leyendo un solo
 * `session.patientId`, como siempre.
 */
export function MisPacientesScreen({ navigation }: Props): React.JSX.Element {
  const { getLinkedPatients } = useUseCases();
  const { session, selectPatient, clearSelectedPatient } = useSession();

  const [status, setStatus] = useState<ScreenStatus>('loading');
  const [patients, setPatients] = useState<readonly LinkedPatient[]>([]);
  const [sumando, setSumando] = useState(false);

  const caregiverId = session?.caregiverId ?? '';
  const seleccionado = session?.patientId ?? '';

  const load = useCallback(async () => {
    if (!caregiverId) return;
    const result = await getLinkedPatients.execute({ caregiverId });
    if (!result.ok) {
      setStatus('error');
      return;
    }
    setPatients(result.value.patients);
    setStatus('ready');

    // El paciente elegido puede haber desaparecido mientras tanto: desde su
    // propio teléfono puede quitarle el acceso a este Cuidador. Dejar el id
    // viejo en la sesión haría que la semana siguiente consulte a alguien a
    // quien ya no se puede ver.
    if (seleccionado && !result.value.patients.some((p) => p.patientId === seleccionado)) {
      clearSelectedPatient();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caregiverId, seleccionado]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  function entrar(patient: LinkedPatient): void {
    selectPatient({ id: patient.patientId, displayName: patient.displayName });
    navigation.navigate('CuidadorHome');
  }

  if (status === 'loading') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (status === 'error') {
    return (
      <View style={styles.centered}>
        <AccessibleText color={colors.critical} bold style={styles.centerText}>
          No pudimos cargar a quiénes cuidás.
        </AccessibleText>
        <AccessibleButton label="Reintentar" variant="secondary" onPress={() => void load()} />
      </View>
    );
  }

  // Cuenta nueva: no hay lista que mostrar todavía, así que el único paso
  // posible es vincular. Mostrar una lista vacía con un botón sería un rodeo.
  if (patients.length === 0) {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <LinkPatientPrompt onLinked={() => void load()} />
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <AccessibleText variant="body" color={colors.textSecondary}>
        {patients.length === 1 ? 'Cuidás a una persona.' : `Cuidás a ${patients.length} personas.`} Elegí a quién
        gestionás.
      </AccessibleText>

      {patients.map((patient) => (
        <Pressable
          key={patient.patientId}
          onPress={() => entrar(patient)}
          accessibilityRole="button"
          accessibilityLabel={`Gestionar a ${nombreDe(patient)}`}
          accessibilityHint="Abre su pastillero semanal"
          style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
        >
          <AccessibleText variant="label" bold>
            {nombreDe(patient)}
          </AccessibleText>
          <AccessibleText variant="small" color={colors.textSecondary}>
            Ver su semana, sus tratamientos y si se tomó lo suyo
          </AccessibleText>
        </Pressable>
      ))}

      {sumando ? (
        <View style={styles.sumarBox}>
          <LinkPatientPrompt
            variant="otro"
            onLinked={() => {
              setSumando(false);
              void load();
            }}
          />
          <AccessibleButton label="Cancelar" variant="secondary" onPress={() => setSumando(false)} />
        </View>
      ) : (
        <AccessibleButton
          label="Sumar a otra persona"
          variant="secondary"
          onPress={() => setSumando(true)}
          accessibilityHint="Pide un código de invitación para vincular a alguien más"
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, gap: spacing.md },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  centerText: { textAlign: 'center' },
  card: {
    minHeight: touchTarget.minHeight,
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.lg,
    gap: spacing.xs,
    ...shadows.card,
  },
  cardPressed: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  sumarBox: { gap: spacing.sm },
});
