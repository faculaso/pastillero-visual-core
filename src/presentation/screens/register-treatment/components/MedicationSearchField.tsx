import React, { useEffect, useState } from 'react';
import { View, TextInput, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import type { Medication } from '../../../../domain';
import type { SearchMedicationCatalogUseCase } from '../../../../application';
import { AccessibleText } from '../../../design-system/AccessibleText';
import { AccessibleButton } from '../../../design-system/AccessibleButton';
import { colors, radii, spacing, touchTarget, typography } from '../../../design-system/tokens';

export interface MedicationSearchFieldProps {
  readonly searchMedicationCatalog: SearchMedicationCatalogUseCase;
  readonly selectedMedication: Medication | null;
  readonly onSelect: (medication: Medication) => void;
  readonly onClear: () => void;
}

/**
 * CU-01 pasos 2-5. Búsqueda explícita por botón (no debounce automático):
 * para el Cuidador, buscar es una acción deliberada, y evita disparar
 * queries en cada tecla en un dispositivo que puede estar con conectividad
 * limitada al sincronizar el catálogo. Al montar, sí se precarga un listado
 * inicial (`browseAll`) para que el Cuidador tenga medicamentos para elegir
 * sin tener que escribir nada primero — una única query, no una por tecla.
 */
export function MedicationSearchField({
  searchMedicationCatalog,
  selectedMedication,
  onSelect,
  onClear,
}: MedicationSearchFieldProps): React.JSX.Element {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<readonly Medication[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [inputFocused, setInputFocused] = useState(false);

  useEffect(() => {
    if (selectedMedication) return;
    void loadBrowseResults();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadBrowseResults(): Promise<void> {
    setStatus('loading');
    const result = await searchMedicationCatalog.execute({ query: '', browseAll: true });
    if (!result.ok) {
      setStatus('error');
      return;
    }
    setResults(result.value.medications);
    setStatus('idle');
  }

  async function handleSearch(): Promise<void> {
    if (query.trim().length === 0) {
      await loadBrowseResults();
      return;
    }
    setStatus('loading');
    const result = await searchMedicationCatalog.execute({ query });
    if (!result.ok) {
      setStatus('error');
      return;
    }
    setResults(result.value.medications);
    setStatus('idle');
  }

  if (selectedMedication) {
    return (
      <View style={styles.selectedCard}>
        <View style={{ flex: 1 }}>
          <AccessibleText variant="label" bold>
            {selectedMedication.name}
          </AccessibleText>
          <AccessibleText variant="small" color={colors.textSecondary}>
            {selectedMedication.presentation}
          </AccessibleText>
        </View>
        <AccessibleButton label="Cambiar" variant="secondary" onPress={onClear} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.anmatBadge}>
        <AccessibleText variant="small" color={colors.primaryDark} bold>
          🇦🇷 Vademécum oficial ANMAT
        </AccessibleText>
      </View>
      <AccessibleText variant="label" bold>
        Buscar medicamento
      </AccessibleText>
      <View style={styles.searchRow}>
        <TextInput
          style={[styles.input, inputFocused && styles.inputFocused]}
          value={query}
          onChangeText={setQuery}
          placeholder="Nombre, principio activo o código de barras"
          placeholderTextColor={colors.textSecondary}
          accessibilityLabel="Buscar medicamento por nombre o código de barras"
          returnKeyType="search"
          onSubmitEditing={handleSearch}
          autoCapitalize="none"
          onFocus={() => setInputFocused(true)}
          onBlur={() => setInputFocused(false)}
        />
        <AccessibleButton label="Buscar" onPress={handleSearch} loading={status === 'loading'} />
      </View>

      {status === 'error' ? (
        <AccessibleText color={colors.critical}>No pudimos buscar en el catálogo. Reintentá.</AccessibleText>
      ) : null}

      {status === 'loading' ? <ActivityIndicator color={colors.primary} /> : null}

      {results.length > 0 && status !== 'loading' ? (
        <View style={styles.results}>
          {results.map((medication) => (
            <Pressable
              key={medication.id}
              onPress={() => onSelect(medication)}
              style={styles.resultRow}
              accessibilityRole="button"
              accessibilityLabel={`Seleccionar ${medication.name}`}
            >
              <AccessibleText variant="body" bold>
                {medication.name}
              </AccessibleText>
              <AccessibleText variant="small" color={colors.textSecondary}>
                {medication.presentation}
              </AccessibleText>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  anmatBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  searchRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  input: {
    flex: 1,
    minHeight: touchTarget.minHeight,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    fontSize: typography.body,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
  inputFocused: {
    borderColor: colors.primaryLight,
  },
  results: {
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  resultRow: {
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    minHeight: touchTarget.minHeight,
    justifyContent: 'center',
  },
  selectedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.successBackground,
    borderRadius: radii.md,
  },
});
