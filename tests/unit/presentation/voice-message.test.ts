import { describe, it, expect } from 'vitest';
import { buildDoseVoiceMessage } from '../../../src/presentation/screens/pastillero-virtual/voice-message';
import { PillShape, MeasurementUnit } from '../../../src/domain';
import type { PendingDoseView } from '../../../src/application';

function buildDoseView(overrides: Partial<PendingDoseView> = {}): PendingDoseView {
  return {
    doseId: 'dose-1',
    treatmentId: 'treatment-1',
    scheduledAt: new Date('2026-08-01T08:00:00.000Z'),
    medicationName: 'Paracetamol',
    visualProfile: { shape: PillShape.ROUND, color: '#FFFFFF' },
    dosagePerTake: { amount: 1, unit: MeasurementUnit.UNIT },
    ...overrides,
  };
}

describe('buildDoseVoiceMessage', () => {
  it('incluye nombre del medicamento, dosis, forma e instrucción de toma', () => {
    const message = buildDoseVoiceMessage(buildDoseView());

    expect(message).toContain('Es hora de tomar Paracetamol.');
    expect(message).toContain('Dosis: 1 comprimido.');
    expect(message).toContain('Forma del comprimido: redonda.');
    expect(message).toContain('Presioná el botón Confirmar Toma después de tomarla.');
  });

  it('incluye la referencia visual (ranura o concentración) cuando está presente', () => {
    const message = buildDoseVoiceMessage(
      buildDoseView({ visualProfile: { shape: PillShape.CAPSULE, color: '#FFF', slotLabel: 'Mañana - Ranura 1' } }),
    );
    expect(message).toContain('Referencia: Mañana - Ranura 1.');
  });

  it('omite la frase de referencia cuando no está presente', () => {
    const message = buildDoseVoiceMessage(buildDoseView({ visualProfile: { shape: PillShape.ROUND, color: '#FFF' } }));
    expect(message).not.toContain('Referencia:');
  });

  it('usa el nombre de unidad correcto en la dosis (mg en palabras, no abreviado)', () => {
    const message = buildDoseVoiceMessage(
      buildDoseView({ dosagePerTake: { amount: 500, unit: MeasurementUnit.MG } }),
    );
    expect(message).toContain('Dosis: 500 miligramos.');
  });

  it('respeta la forma real del comprimido en el mensaje', () => {
    const message = buildDoseVoiceMessage(
      buildDoseView({ visualProfile: { shape: PillShape.CAPSULE, color: '#FFF' } }),
    );
    expect(message).toContain('Forma del comprimido: cápsula.');
  });
});
