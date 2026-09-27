import React from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AdultoMayorStackParamList } from '../../navigation/types';
import { useUseCases } from '../../providers/UseCasesProvider';
import { useAlarmDiagnostics } from '../../hooks/useAlarmDiagnostics';
import { AccessibleText } from '../../design-system/AccessibleText';
import { AccessibleButton } from '../../design-system/AccessibleButton';
import { colors, spacing, radii, touchTarget } from '../../design-system/tokens';
import { describeNextAlarm } from '../../utils/describe-next-alarm';

export interface DiagnosticoAlarmasScreenProps {
  readonly patientId: string;
  readonly navigation: NativeStackNavigationProp<AdultoMayorStackParamList, 'DiagnosticoAlarmas'>;
}

interface FilaProps {
  readonly estado: boolean | null;
  readonly bien: string;
  readonly mal: string;
  readonly arreglo?: { readonly label: string; readonly onPress: () => void };
}

/**
 * Tres estados, no dos. `null` es "no se pudo consultar", y se muestra
 * distinto de "está mal": decirle a alguien que algo falla cuando en
 * realidad no se pudo averiguar lo manda a tocar ajustes sin motivo.
 */
function Fila({ estado, bien, mal, arreglo }: FilaProps): React.JSX.Element {
  const sinDato = estado === null;
  const color = sinDato ? colors.textSecondary : estado ? colors.success : colors.critical;
  const marca = sinDato ? '—' : estado ? '✓' : '✗';

  return (
    <View style={styles.fila}>
      <View style={styles.filaTexto}>
        <AccessibleText variant="title" bold color={color} style={styles.marca}>
          {marca}
        </AccessibleText>
        <AccessibleText variant="body" color={colors.textPrimary} style={styles.filaLabel}>
          {sinDato ? 'No se pudo consultar' : estado ? bien : mal}
        </AccessibleText>
      </View>
      {estado === false && arreglo ? (
        <AccessibleButton label={arreglo.label} variant="secondary" onPress={arreglo.onPress} />
      ) : null}
    </View>
  );
}

/**
 * Responde una sola pregunta: **¿van a sonar las alarmas de este teléfono?**
 *
 * Existe porque todo lo que puede romperla falla en silencio, y averiguarlo
 * a distancia era imposible: hubo que conectar el teléfono por cable para
 * descubrir que el canal estaba mudo, que las alarmas estaban en el aparato
 * equivocado y que el modo silencio se las comía. Acá eso se lee de un
 * vistazo y se manda por foto.
 *
 * Por eso no dice "permiso POST_NOTIFICATIONS" ni "canal": dice si la alarma
 * va a sonar y, cuando no, ofrece el botón que lo arregla.
 */
export function DiagnosticoAlarmasScreen({
  patientId,
  navigation,
}: DiagnosticoAlarmasScreenProps): React.JSX.Element {
  const { notificationScheduler, syncDoseAlarms } = useUseCases();
  const { datos, cargando, revisando, revisar, leer } = useAlarmDiagnostics(
    notificationScheduler,
    syncDoseAlarms,
    patientId,
  );
  const insets = useSafeAreaInsets();

  const sinAlarmas = datos.programadas === 0;

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.md }]}>
      <Pressable
        onPress={() => navigation.goBack()}
        accessibilityRole="button"
        accessibilityLabel="Volver"
        hitSlop={12}
        style={({ pressed }) => [styles.volver, pressed && styles.volverPressed]}
      >
        <AccessibleText variant="body" bold color={colors.primary}>
          ← Volver
        </AccessibleText>
      </Pressable>

      <ScrollView contentContainerStyle={[styles.contenido, { paddingBottom: insets.bottom + spacing.xl }]}>
        <AccessibleText variant="title" bold style={styles.titulo}>
          ¿Van a sonar tus alarmas?
        </AccessibleText>

        {cargando ? (
          <View style={styles.centrado}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <>
            <View style={styles.tarjeta}>
              <Fila
                estado={datos.notificaciones}
                bien="El teléfono puede mostrar avisos"
                mal="El teléfono tiene los avisos apagados"
                arreglo={{
                  label: 'Permitir avisos',
                  onPress: () => void notificationScheduler.openNotificationSettings(),
                }}
              />
              <Fila
                estado={datos.alarmasExactas}
                bien="Las alarmas suenan a la hora exacta"
                mal="Las alarmas pueden llegar tarde"
              />
              <Fila
                estado={datos.sueneEnSilencio}
                bien="Suena aunque el teléfono esté en silencio"
                mal="Con el teléfono en silencio no va a sonar"
                arreglo={{
                  label: 'Que suene siempre',
                  onPress: () => void notificationScheduler.openDndAccessSettings(),
                }}
              />
            </View>

            <View style={[styles.tarjeta, sinAlarmas ? styles.tarjetaAlerta : null]}>
              <AccessibleText
                variant="display"
                bold
                color={sinAlarmas ? colors.critical : colors.success}
                style={styles.numero}
              >
                {datos.programadas === null ? '—' : String(datos.programadas)}
              </AccessibleText>
              <AccessibleText variant="body" color={colors.textSecondary} style={styles.centrarTexto}>
                {datos.programadas === null
                  ? 'No se pudo contar las alarmas de este teléfono'
                  : sinAlarmas
                    ? 'Este teléfono no tiene ninguna alarma puesta'
                    : datos.programadas === 1
                      ? 'alarma puesta en este teléfono'
                      : 'alarmas puestas en este teléfono'}
              </AccessibleText>
              {datos.proxima ? (
                <AccessibleText variant="body" bold style={styles.centrarTexto}>
                  La próxima, {describeNextAlarm(datos.proxima, new Date())}
                </AccessibleText>
              ) : null}
            </View>

            <AccessibleButton
              label={revisando ? 'Revisando…' : 'Revisar ahora'}
              onPress={revisar}
              loading={revisando}
              disabled={revisando}
            />
            <AccessibleText variant="small" color={colors.textSecondary} style={styles.centrarTexto}>
              Vuelve a poner las alarmas que falten y actualiza esta pantalla.
            </AccessibleText>

            <Pressable onPress={leer} accessibilityRole="button" accessibilityLabel="Volver a medir" hitSlop={8}>
              <AccessibleText variant="small" bold color={colors.primary} style={styles.centrarTexto}>
                Volver a medir
              </AccessibleText>
            </Pressable>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  volver: {
    alignSelf: 'flex-start',
    marginLeft: spacing.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    minHeight: touchTarget.minHeight / 2,
    justifyContent: 'center',
  },
  volverPressed: { opacity: 0.6 },
  contenido: { padding: spacing.lg, gap: spacing.lg },
  titulo: { textAlign: 'center' },
  centrado: { paddingVertical: spacing.xxl, alignItems: 'center' },
  tarjeta: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  tarjetaAlerta: { backgroundColor: colors.criticalBackground },
  fila: { gap: spacing.sm },
  filaTexto: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  marca: { width: 32, textAlign: 'center' },
  filaLabel: { flex: 1 },
  numero: { textAlign: 'center' },
  centrarTexto: { textAlign: 'center' },
});
