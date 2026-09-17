import {
  Ok,
  Err,
  type Result,
  DomainErrors,
  type DomainError,
  StockAlertLevel,
  calculateAdherenceMetrics,
  type TreatmentRepository,
  type DoseRepository,
  type StockRepository,
} from '../../domain';
import type { UseCase } from '../core/use-case';
import type { Clock } from '../ports/clock.port';
import type { NotificationScheduler } from '../ports/notification-scheduler.port';
import type { MonitorAdherenceInput, MonitorAdherenceOutput } from '../dto/monitor-adherence.dto';

const DEFAULT_MONITORING_PERIOD_DAYS = 30;

/**
 * CU-03 "Monitorear Adherencia y Gestionar Alertas de Stock Crítico".
 *
 * Orquestación:
 *  1. Carga `Treatment` y autoriza (paso 1: el cuidador entra al módulo).
 *  2. Trae las tomas del período vía `DoseRepository` — NO usa `treatment.stock`
 *     embebido para el cálculo de stock: lee `StockRepository.getStock`
 *     directamente, porque `ConfirmDoseUseCase` decrementa a través de ese
 *     repo y el campo embebido en `Treatment` puede quedar desactualizado
 *     entre sincronizaciones. Es la única fuente de verdad para cantidad actual.
 *  3. Delega el cálculo puro (% adherencia, días restantes, nivel de alerta)
 *     a `calculateAdherenceMetrics` del dominio (pasos 2-3).
 *  4. Si el nivel resultante es CRITICAL, despacha la alerta (paso 4) vía
 *     `NotificationScheduler` — best-effort: si falla el despacho, la
 *     consulta de métricas igual se devuelve correctamente al caregiver.
 *
 * Nota: la actualización de stock tras la compra (paso 5, "Actualizar
 * Stock") es una acción de escritura independiente — corresponde a un
 * `UpdateStockUseCase` separado, fuera del alcance de este caso de uso
 * de solo-lectura + alerta.
 */
export class MonitorAdherenceUseCase
  implements UseCase<MonitorAdherenceInput, MonitorAdherenceOutput>
{
  constructor(
    private readonly treatmentRepository: TreatmentRepository,
    private readonly doseRepository: DoseRepository,
    private readonly stockRepository: StockRepository,
    private readonly notificationScheduler: NotificationScheduler,
    private readonly clock: Clock,
  ) {}

  async execute(
    input: MonitorAdherenceInput,
  ): Promise<Result<MonitorAdherenceOutput, DomainError>> {
    const treatmentResult = await this.treatmentRepository.findById(input.treatmentId);
    if (!treatmentResult.ok) return treatmentResult;
    const treatment = treatmentResult.value;
    if (!treatment) return Err(DomainErrors.treatmentNotFound(input.treatmentId));

    if (treatment.caregiverId !== input.requestingCaregiverId) {
      return Err(DomainErrors.unauthorizedActor(input.requestingCaregiverId, 'monitorAdherence'));
    }

    const now = this.clock.now();
    const periodEnd = input.periodEnd ?? now;
    const periodStart = input.periodStart ?? this.subtractDays(periodEnd, DEFAULT_MONITORING_PERIOD_DAYS);

    if (periodStart.getTime() > periodEnd.getTime()) {
      return Err(DomainErrors.validation('periodStart no puede ser posterior a periodEnd'));
    }

    // --- Lecturas en paralelo: independientes entre sí ---
    const [dosesResult, stockResult] = await Promise.all([
      this.doseRepository.findByTreatmentInRange(treatment.id, periodStart, periodEnd),
      this.stockRepository.getStock(treatment.id),
    ]);
    if (!dosesResult.ok) return dosesResult;
    if (!stockResult.ok) return stockResult;

    // --- Cálculo puro de dominio (pasos 2-3: % adherencia, días restantes, nivel) ---
    const metrics = calculateAdherenceMetrics(
      treatment.id,
      periodStart,
      periodEnd,
      dosesResult.value,
      stockResult.value,
    );

    // --- Paso 4: alerta crítica de reposición, best-effort ---
    let criticalAlertDispatched = false;
    if (metrics.stockAlertLevel === StockAlertLevel.CRITICAL) {
      const alertResult = await this.notificationScheduler.dispatchStockAlert(
        treatment,
        metrics.stockAlertLevel,
        metrics.estimatedDaysRemaining,
      );
      criticalAlertDispatched = alertResult.ok;
    }

    return Ok({
      metrics,
      medicationName: treatment.medication.name,
      stock: stockResult.value,
      criticalAlertDispatched,
    });
  }

  private subtractDays(date: Date, days: number): Date {
    const d = new Date(date);
    d.setDate(d.getDate() - days);
    return d;
  }
}
