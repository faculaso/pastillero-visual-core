import { AdherenceLevel, calculateAdherenceLevel } from '../../domain';
import { colors } from '../design-system/tokens';

export interface AdherenceDisplay {
  readonly level: AdherenceLevel;
  /** Rótulo corto SIEMPRE visible — el color nunca viaja solo. */
  readonly label: string;
  readonly color: string;
  readonly background: string;
  readonly border: string;
}

const DISPLAY: Record<AdherenceLevel, Omit<AdherenceDisplay, 'level'>> = {
  [AdherenceLevel.GOOD]: {
    label: 'Al día',
    color: colors.success,
    background: colors.successBackground,
    border: '#BBF7D0',
  },
  [AdherenceLevel.PARTIAL]: {
    label: 'Irregular',
    color: colors.warning,
    background: colors.warningBackground,
    border: '#FED7AA',
  },
  [AdherenceLevel.POOR]: {
    label: 'Muy baja',
    color: colors.critical,
    background: colors.criticalBackground,
    border: '#FECACA',
  },
};

/**
 * El porcentaje de adherencia se pintaba SIEMPRE de `colors.success`, fijo.
 * Un 4% salía del mismo verde tranquilizador que un 100% — y el Cuidador
 * abre esta pantalla justamente para enterarse de que algo anda mal. Peor
 * que no tener color: el color mentía.
 *
 * Mismos tokens y mismo criterio que `StockAlertBadge` (color + texto
 * explícito, nunca solo color), para que las dos señales de la pantalla se
 * lean como un mismo sistema.
 */
export function getAdherenceDisplay(adherencePercentage: number): AdherenceDisplay {
  const level = calculateAdherenceLevel(adherencePercentage);
  return { level, ...DISPLAY[level] };
}

/**
 * El dominio guarda dos decimales (`4.17`) porque es una división real y
 * redondearla ahí perdería precisión para cualquier otro consumidor. Pero
 * nadie dice "cuatro coma diecisiete por ciento": en pantalla va entero.
 */
export function formatAdherencePercentage(adherencePercentage: number): string {
  return `${Math.round(adherencePercentage)}%`;
}
