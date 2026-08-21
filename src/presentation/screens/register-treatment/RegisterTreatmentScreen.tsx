import React, { useState } from 'react';
import { ScrollView, View, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { Medication } from '../../../domain';
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

type Props = NativeStackScreenProps<CuidadorStackParamList, 'RegisterTreatment'>;

const INITIAL_VISUAL: VisualProfileFormValue = {
  shape: PillShape.ROUND,
  color: '#FFFFFF',
  slotLabel: '',
  pillImageUrl: '',
  boxImageUrl: '',
};

const INITIAL_DOSAGE: DosageAndStockFormValue = {
  timeHour: '08',
  timeMinute: '00',
  dosageAmount: '1',
  dosageUnit: MeasurementUnit.UNIT,
  initialStock: '30',
  dailyConsumption: '1',
};

/**
 * CU-01 completo, pasos 1-10, en una única pantalla con secciones (en vez
 * de un wizard multi-paso): para un alta que se hace pocas veces por
 * tratamiento, evita la fricción de navegar entre pantallas y le permite
 * al Cuidador revisar todo antes de confirmar. Persiste recién al final,
 * vía `RegisterTreatmentUseCase` — nada se guarda a mitad de formulario.
 */
export function RegisterTreatmentScreen({ navigation }: Props): React.JSX.Element {
  const { registerTreatment, searchMedicationCatalog, suggestVisualProfile } = useUseCases();
  const { session } = useSession();

  const [medication, setMedication] = useState<Medication | null>(null);
  const [visual, setVisual] = useState<VisualProfileFormValue>(INITIAL_VISUAL);
  const [dosage, setDosage] = useState<DosageAndStockFormValue>(INITIAL_DOSAGE);
  const [status, setStatus] = useState<'idle' | 'submitting' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const canSubmit = medication !== null && status !== 'submitting';

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
    setDosage(INITIAL_DOSAGE);

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
        slotLabel: visual.slotLabel || undefined,
        pillImageUrl: visual.pillImageUrl || undefined,
        boxImageUrl: visual.boxImageUrl || undefined,
      },
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
      setError(describeRegisterError(result.error.code));
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

function describeRegisterError(code: string): string {
  switch (code) {
    case 'MEDICATION_NOT_FOUND':
      return 'El medicamento seleccionado ya no está disponible. Buscalo de nuevo.';
    case 'DOSAGE_SCHEME_INVALID':
      return 'El horario ingresado no es válido.';
    case 'VALIDATION_ERROR':
      return 'Falta completar algún dato del perfil visual (forma, color o al menos una foto).';
    default:
      return 'No pudimos guardar el tratamiento. Intentá de nuevo.';
  }
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  submitRow: { marginTop: spacing.md },
});
