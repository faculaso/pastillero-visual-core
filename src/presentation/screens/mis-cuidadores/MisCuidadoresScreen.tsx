import React, { useCallback, useState } from 'react';
import { View, ScrollView, ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AdultoMayorStackParamList } from '../../navigation/types';
import type { GetPairingOverviewOutput } from '../../../application';
import { useUseCases } from '../../providers/UseCasesProvider';
import { AccessibleText } from '../../design-system/AccessibleText';
import { AccessibleButton } from '../../design-system/AccessibleButton';
import { AppDialog } from '../../design-system/AppDialog';
import { colors, radii, spacing, shadows, touchTarget } from '../../design-system/tokens';

export interface MisCuidadoresScreenProps {
  readonly patientId: string;
  readonly navigation: NativeStackNavigationProp<AdultoMayorStackParamList, 'MisCuidadores'>;
}

type ScreenStatus = 'loading' | 'ready' | 'error';

/**
 * Antes había UN código por persona, eterno e irrevocable, que solo se
 * podía mirar: quien lo escuchaba una vez quedaba con acceso para siempre,
 * y no había forma de saber quién lo estaba usando.
 *
 * Esta pantalla lo convierte en algo manejable desde el teléfono del Adulto
 * Mayor: ve por nombre quién lo cuida, puede sacarle el acceso a alguien, y
 * puede generar hasta tres códigos distintos — uno por cuidador — o dar de
 * baja los que dictó y nadie usó.
 */
export function MisCuidadoresScreen({ patientId, navigation }: MisCuidadoresScreenProps): React.JSX.Element {
  const { getPairingOverview, createInviteCode, revokeInviteCode, unlinkCaregiver } = useUseCases();

  // Mismo motivo que en `PastilleroVirtualScreen`: el `SafeAreaView` de este
  // build no aplica el padding de arriba, así que el inset va a mano. Sin
  // esto "Volver" queda medio tapado por la barra de estado y el toque en el
  // centro del botón lo come el sistema.
  const insets = useSafeAreaInsets();

  const [status, setStatus] = useState<ScreenStatus>('loading');
  const [data, setData] = useState<GetPairingOverviewOutput | null>(null);
  const [busy, setBusy] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  /** `null` = ningún cartel abierto. Guardan lo que el cartel necesita nombrar. */
  const [codigoABajar, setCodigoABajar] = useState<{ id: string; code: string } | null>(null);
  const [cuidadorAQuitar, setCuidadorAQuitar] = useState<{ id: string; nombre: string } | null>(null);

  const load = useCallback(async () => {
    const result = await getPairingOverview.execute({ patientId });
    if (!result.ok) {
      setStatus('error');
      return;
    }
    setData(result.value);
    setStatus('ready');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function generar(): Promise<void> {
    setBusy(true);
    setAviso(null);
    const result = await createInviteCode.execute();
    setBusy(false);
    if (!result.ok) {
      setAviso(
        result.error.code === 'INVITE_CODE_LIMIT_REACHED'
          ? 'Ya tenés todos tus lugares ocupados.'
          : 'No pudimos generar el código. Intentá de nuevo.',
      );
      return;
    }
    await load();
  }


  async function darDeBaja(codeId: string): Promise<void> {
    setBusy(true);
    setAviso(null);
    const result = await revokeInviteCode.execute({ codeId });
    setBusy(false);
    if (!result.ok) {
      setAviso('No pudimos dar de baja el código. Intentá de nuevo.');
      return;
    }
    await load();
  }


  async function quitar(caregiverId: string): Promise<void> {
    setBusy(true);
    setAviso(null);
    const result = await unlinkCaregiver.execute({ caregiverId });
    setBusy(false);
    if (!result.ok) {
      setAviso('No pudimos quitarle el acceso. Intentá de nuevo.');
      return;
    }
    await load();
  }

  const ocupados = data ? data.caregivers.length + data.pendingCodes.length : 0;

  return (
    <View style={styles.screen}>
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.md }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Volver a mi pastillero"
          hitSlop={8}
          style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
        >
          <AccessibleText variant="small" bold color={colors.primary}>
            Volver
          </AccessibleText>
        </Pressable>
      </View>

      {status === 'loading' && !data ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : status === 'error' ? (
        <View style={styles.centered}>
          <AccessibleText color={colors.critical} bold style={styles.centerText}>
            No pudimos cargar quién te cuida.
          </AccessibleText>
          <AccessibleButton label="Reintentar" variant="secondary" onPress={() => void load()} />
        </View>
      ) : data ? (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <AccessibleText variant="title" bold>
              Quién te cuida
            </AccessibleText>
            {/* El cupo se dice en palabras, no solo con un color o un contador suelto. */}
            <AccessibleText variant="body" color={colors.textSecondary}>
              {ocupados} de {data.maxCaregivers} lugares ocupados.
            </AccessibleText>
          </View>

          <View style={styles.section}>
            <AccessibleText variant="label" bold>
              Te cuidan
            </AccessibleText>
            {data.caregivers.length === 0 ? (
              <AccessibleText variant="body" color={colors.textSecondary}>
                Todavía no hay nadie. Generá un código y dictáselo a quien te vaya a cuidar.
              </AccessibleText>
            ) : (
              data.caregivers.map((caregiver) => {
                const nombre = caregiver.displayName?.trim() || 'Cuidador sin nombre';
                return (
                  <View key={caregiver.caregiverId} style={styles.card}>
                    <AccessibleText variant="label" bold>
                      {nombre}
                    </AccessibleText>
                    <AccessibleButton
                      label="Quitarle el acceso"
                      variant="secondary"
                      disabled={busy}
                      accessibilityHint={`Deja de ver tus tomas. ${nombre} ya no te va a poder cargar tratamientos.`}
                      onPress={() => setCuidadorAQuitar({ id: caregiver.caregiverId, nombre })}
                    />
                  </View>
                );
              })
            )}
          </View>

          <View style={styles.section}>
            <AccessibleText variant="label" bold>
              Códigos que todavía nadie usó
            </AccessibleText>
            {data.pendingCodes.length === 0 ? (
              <AccessibleText variant="body" color={colors.textSecondary}>
                No tenés códigos sin usar.
              </AccessibleText>
            ) : (
              data.pendingCodes.map((code) => (
                <View key={code.id} style={styles.card}>
                  <View style={styles.codeBox}>
                    <AccessibleText variant="display" bold color={colors.primaryDark} accessibilityLabel={`Código ${code.code.split('').join(' ')}`}>
                      {code.code}
                    </AccessibleText>
                  </View>
                  <AccessibleText variant="small" color={colors.textSecondary} style={styles.centerText}>
                    Dictáselo a una sola persona: sirve una vez.
                  </AccessibleText>
                  <AccessibleButton
                    label="Dar de baja este código"
                    variant="secondary"
                    disabled={busy}
                    onPress={() => setCodigoABajar({ id: code.id, code: code.code })}
                  />
                </View>
              ))
            )}
          </View>

          {aviso ? (
            <AccessibleText color={colors.critical} bold style={styles.centerText} accessibilityLiveRegion="polite">
              {aviso}
            </AccessibleText>
          ) : null}

          {data.slotsLeft > 0 ? (
            <AccessibleButton
              label="Generar un código nuevo"
              onPress={() => void generar()}
              disabled={busy}
              loading={busy}
              accessibilityHint="Para sumar a otra persona que te cuide"
            />
          ) : (
            <View style={styles.limitBox}>
              <AccessibleText variant="body" bold color={colors.warning}>
                Llegaste al máximo de {data.maxCaregivers}.
              </AccessibleText>
              <AccessibleText variant="body" color={colors.textSecondary}>
                Para sumar a alguien más, quitale el acceso a un cuidador o dá de baja un código sin usar.
              </AccessibleText>
            </View>
          )}
        </ScrollView>
      ) : null}

      <AppDialog
        visible={codigoABajar !== null}
        title="Dar de baja este código"
        message={
          codigoABajar
            ? `El código ${codigoABajar.code} va a dejar de servir. Si ya se lo dictaste a alguien, no va a poder entrar con él.`
            : undefined
        }
        onDismiss={() => setCodigoABajar(null)}
        actions={[
          {
            label: 'Dar de baja',
            variant: 'danger',
            onPress: () => {
              const elegido = codigoABajar;
              setCodigoABajar(null);
              if (elegido) void darDeBaja(elegido.id);
            },
          },
          { label: 'Cancelar', variant: 'secondary', onPress: () => setCodigoABajar(null) },
        ]}
      />

      <AppDialog
        visible={cuidadorAQuitar !== null}
        title={cuidadorAQuitar ? `Quitarle el acceso a ${cuidadorAQuitar.nombre}` : ''}
        message={
          cuidadorAQuitar
            ? `${cuidadorAQuitar.nombre} ya no va a ver tus tomas ni va a poder cargarte tratamientos. Los tratamientos que ya te cargó siguen como están, y vos los seguís viendo en tu pastillero.`
            : undefined
        }
        onDismiss={() => setCuidadorAQuitar(null)}
        actions={[
          {
            label: 'Quitar el acceso',
            variant: 'danger',
            onPress: () => {
              const elegido = cuidadorAQuitar;
              setCuidadorAQuitar(null);
              if (elegido) void quitar(elegido.id);
            },
          },
          { label: 'Cancelar', variant: 'secondary', onPress: () => setCuidadorAQuitar(null) },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  topBar: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  backButton: {
    alignSelf: 'flex-start',
    minHeight: touchTarget.minHeight,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.surface,
  },
  backButtonPressed: { backgroundColor: colors.borderLight },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, gap: spacing.md },
  content: { padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing.xxl },
  header: { gap: spacing.xs },
  section: { gap: spacing.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.card,
  },
  codeBox: {
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
    borderRadius: radii.xl,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  limitBox: {
    backgroundColor: colors.warningBackground,
    borderRadius: radii.xl,
    borderWidth: 2,
    borderColor: colors.warning,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  centerText: { textAlign: 'center' },
});
