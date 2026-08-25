import React, { useState } from 'react';
import { ScrollView, View, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { Medication, DomainError } from '../../../domain';
import { PillShape, MeasurementUnit, DosageFrequency } from '../../../domain';
import { useUseCases } from '../../providers/UseCasesProvider';
import { useSession } from '../../providers/SessionContext';
import type { CuidadorStackParamList } from '../../navigation/types';
import { AccessibleText } from '../../design-system/AccessibleText';
import { AccessibleButton } from '../../design-system/AccessibleButton';
import { colors, spacing } from '../../design-system/tokens';
import { MedicationSearchField } from './components/MedicationSearchField';
import { VisualProfileEditor, type VisualProfileFormValue } from './components/VisualProfileEditor';
import { DosageAndStockForm, type DosageAndStockFormValue } from './components/DosageAndStockForm';
import { LinkPatientPrompt } from './components/LinkPatientPrompt';

type Props = NativeStackScreenProps<CuidadorStackParamList, 'RegisterTreatment'>;

const INITIAL_VISUAL: VisualProfileFormValue = {
  shape: PillShape.ROUND,
  color: '#FFFFFF',
  secondaryColor: '',
  slotLabel: '',
  pillImageUrl: '',
  boxImageUrl: '',
};

function buildInitialDosage(suggestedHour?: number): DosageAndStockFormValue {
  return {
    timeHour: String(suggestedHour ?? 8).padStart(2, '0'),
    timeMinute: '00',
    dosageAmount: '1',
    dosageUnit: MeasurementUnit.UNIT,
    initialStock: '30',
    dailyConsumption: '1',
    allDays: true,
    weekdays: [],
  };
}

/**
 * CU-01 completo, pasos 1-10, en una única pantalla con secciones (en vez
 * de un wizard multi-paso): para un alta que se hace pocas veces por
 * tratamiento, evita la fricción de navegar entre pantallas y le permite
 * al Cuidador revisar todo antes de confirmar. Persiste recién al final,
 * vía `RegisterTreatmentUseCase` — nada se guarda a mitad de formulario.
 */
export function RegisterTreatmentScreen({ navigation, route }: Props): React.JSX.Element {
  const { registerTreatment, searchMedicationCatalog, suggestVisualProfile } = useUseCases();
  const { session } = useSession();

  const suggestedHour = route.params?.suggestedHour;
  const [medication, setMedication] = useState<Medication | null>(null);
  const [visual, setVisual] = useState<VisualProfileFormValue>(INITIAL_VISUAL);
  const [dosage, setDosage] = useState<DosageAndStockFormValue>(() => buildInitialDosage(suggestedHour));
  const [status, setStatus] = useState<'idle' | 'submitting' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const canSubmit = medication !== null && status !== 'submitting';

  // Sin paciente vinculado, `registerTreatment` fallaría recién al guardar
  // (patientId vacío) — se corta antes de mostrar el formulario, con un
  // mensaje honesto sobre la causa real en vez de un error de dominio
  // genérico mal interpretado como un problema del perfil visual.
  if (session && session.role === 'CUIDADOR' && !session.patientId) {
    return <LinkPatientPrompt />;
  }

  /**
   * CU-01 pasos 6-8 (auto-completado): al elegir el medicamento, se le pide
   * al catálogo ANMAT una sugerencia de forma/ranura/stock. Es best-effort
   * y no bloqueante — si falla o no hay datos ANMAT para ese medicamento,
   * el formulario simplemente arranca con los defaults de siempre. El
   * Cuidador ve el resultado ya reflejado en `VisualProfileEditor` /
   * `DosageAndStockForm` y puede corregir cualquier campo antes de guardar.
   */
  async function handleSelectMedication(selected: Medication): Promise<void> {
    setMedication(selected);
    setVisual(INITIAL_VISUAL);
    setDosage(buildInitialDosage(suggestedHour));

    try {
      const result = await suggestVisualProfile.execute({ medicationId: selected.id });
      if (!result.ok || !result.value.suggestion) return;

      const { shape, slotLabel, suggestedStock } = result.value.suggestion;
      setVisual((current) => ({ ...current, shape, slotLabel: slotLabel ?? current.slotLabel }));
      if (suggestedStock) {
        setDosage((current) => ({
          ...current,
          initialStock: String(suggestedStock.quantity),
          dosageUnit: suggestedStock.unit,
        }));
      }
    } catch {
      // Best-effort real: si el provider falla (o no está implementado en
      // este build), el formulario sigue con los defaults — nunca bloquea
      // la selección del medicamento en sí.
    }
  }

  async function handleSubmit(): Promise<void> {
    if (!medication || !session) return;

    const parsed = parseFormValues(dosage);
    if (!parsed.ok) {
      setStatus('error');
      setError(parsed.message);
      return;
    }

    setStatus('submitting');
    setError(null);

    const result = await registerTreatment.execute({
      caregiverId: session.caregiverId,
      patientId: session.patientId,
      medicationId: medication.id,
      visualProfile: {
        shape: visual.shape,
        color: visual.color,
        secondaryColor: visual.shape === PillShape.CAPSULE_BICOLOR ? visual.secondaryColor || undefined : undefined,
        slotLabel: visual.slotLabel || undefined,
        pillImageUrl: visual.pillImageUrl || undefined,
        boxImageUrl: visual.boxImageUrl || undefined,
      },
      // El checkbox "Todos los días" todavía no tiene forma de elegir días
      // sueltos (se probaron un par de variantes de esa UI y se sacaron) —
      // hasta que la tenga, el tratamiento siempre se guarda como DAILY,
      // destildado o no, para no bloquear el guardado con un error de
      // "elegí un día" que no hay cómo resolver desde acá.
      dosageScheme: {
        frequency: DosageFrequency.DAILY,
        timesOfDay: [{ hour: parsed.timeHour, minute: parsed.timeMinute }],
        dosagePerTake: { amount: parsed.dosageAmount, unit: dosage.dosageUnit },
        startDate: new Date(),
      },
      initialStock: {
        currentQuantity: parsed.initialStock,
        dailyConsumption: parsed.dailyConsumption,
        unit: dosage.dosageUnit,
      },
    });

    if (!result.ok) {
      setStatus('error');
      setError(describeRegisterError(result.error));
      return;
    }

    setStatus('idle');
    navigation.replace('AdherenceDashboard', { treatmentId: result.value.treatment.id });
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <AccessibleText variant="title" bold>
        Nuevo tratamiento
      </AccessibleText>

      <MedicationSearchField
        searchMedicationCatalog={searchMedicationCatalog}
        selectedMedication={medication}
        onSelect={handleSelectMedication}
        onClear={() => setMedication(null)}
      />

      {medication ? (
        <>
          <VisualProfileEditor value={visual} onChange={setVisual} />
          <DosageAndStockForm value={dosage} onChange={setDosage} />

          {error ? (
            <AccessibleText color={colors.critical} bold>
              {error}
            </AccessibleText>
          ) : null}

          <View style={styles.submitRow}>
            <AccessibleButton
              label="Guardar tratamiento"
              variant="success"
              fullHeight
              disabled={!canSubmit}
              loading={status === 'submitting'}
              onPress={handleSubmit}
            />
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

interface ParsedFormValues {
  readonly ok: true;
  readonly timeHour: number;
  readonly timeMinute: number;
  readonly dosageAmount: number;
  readonly initialStock: number;
  readonly dailyConsumption: number;
}
interface ParseError {
  readonly ok: false;
  readonly message: string;
}

/**
 * Validación de FORMATO (¿es un número?) a nivel de UI — la validación de
 * INVARIANTES DE NEGOCIO (¿es positivo?, ¿el esquema es coherente?) ya la
 * hacen las factories de dominio dentro de `RegisterTreatmentUseCase`. Acá
 * solo se evita mandarle strings vacíos/no numéricos al use case.
 */
function parseFormValues(v: DosageAndStockFormValue): ParsedFormValues | ParseError {
  const timeHour = Number(v.timeHour);
  const timeMinute = Number(v.timeMinute);
  const dosageAmount = Number(v.dosageAmount);
  const initialStock = Number(v.initialStock);
  const dailyConsumption = Number(v.dailyConsumption);

  if ([timeHour, timeMinute, dosageAmount, initialStock, dailyConsumption].some((n) => Number.isNaN(n))) {
    return { ok: false, message: 'Revisá que los campos de horario, dosis y stock sean números válidos.' };
  }

  return { ok: true, timeHour, timeMinute, dosageAmount, initialStock, dailyConsumption };
}

/**
 * `VALIDATION_ERROR` es un código genérico que cubre varios invariantes
 * distintos (color, horario, cantidades, ids de actor) — mostrar un texto
 * fijo para todos ("revisá el color") mentía sobre la causa real cuando el
 * problema era otro. Se usa el mensaje propio del `DomainError` (ya en
 * español, generado por la factory que lo lanzó) en vez de adivinar.
 */
function describeRegisterError(error: DomainError): string {
  switch (error.code) {
    case 'MEDICATION_NOT_FOUND':
      return 'El medicamento seleccionado ya no está disponible. Buscalo de nuevo.';
    case 'DOSAGE_SCHEME_INVALID':
      return 'El horario ingresado no es válido.';
    case 'VALIDATION_ERROR':
    case 'STOCK_INVALID_QUANTITY':
      return error.message;
    default:
      return 'No pudimos guardar el tratamiento. Intentá de nuevo.';
  }
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  submitRow: { marginTop: spacing.md },
});
