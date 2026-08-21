import {
  Ok,
  Err,
  type Result,
  DomainErrors,
  type DomainError,
  StockAlertLevel,
  updateStockQuantity,
  calculateStockAlertLevel,
  type TreatmentRepository,
  type StockRepository,
} from '../../domain';
import type { UseCase } from '../core/use-case';
import type { NotificationScheduler } from '../ports/notification-scheduler.port';
import type { UpdateStockInput, UpdateStockOutput } from '../dto/update-stock.dto';

/**
 * CU-03 paso 5: "El Cuidador compra la medicación y pulsa Actualizar Stock".
 * Cierra el ciclo abierto por `MonitorAdherenceUseCase`: valida la nueva
 * cantidad, persiste y, si el nivel de alerta deja de ser CRITICAL,
 * limpia la notificación previa (best-effort).
 */
export class UpdateStockUseCase implements UseCase<UpdateStockInput, UpdateStockOutput> {
  constructor(
    private readonly treatmentRepository: TreatmentRepository,
    private readonly stockRepository: StockRepository,
    private readonly notificationScheduler: NotificationScheduler,
  ) {}

  async execute(input: UpdateStockInput): Promise<Result<UpdateStockOutput, DomainError>> {
    const treatmentResult = await this.treatmentRepository.findById(input.treatmentId);
    if (!treatmentResult.ok) return treatmentResult;
    const treatment = treatmentResult.value;
    if (!treatment) return Err(DomainErrors.treatmentNotFound(input.treatmentId));

    if (treatment.caregiverId !== input.requestingCaregiverId) {
      return Err(DomainErrors.unauthorizedActor(input.requestingCaregiverId, 'updateStock'));
    }

    // Fuente de verdad del stock actual: el repo, no el agregado embebido (mismo criterio que Monitor).
    const currentStockResult = await this.stockRepository.getStock(treatment.id);
    if (!currentStockResult.ok) return currentStockResult;

    const validatedStockResult = updateStockQuantity(currentStockResult.value, input.newQuantity);
    if (!validatedStockResult.ok) return validatedStockResult;

    const persistedStockResult = await this.stockRepository.updateStock(
      treatment.id,
      validatedStockResult.value.currentQuantity,
    );
    if (!persistedStockResult.ok) return persistedStockResult;

    const newAlertLevel = calculateStockAlertLevel(persistedStockResult.value);

    if (newAlertLevel !== StockAlertLevel.CRITICAL) {
      await this.notificationScheduler.clearStockAlert(treatment.id); // best-effort, no interrumpe el flujo
    }

    return Ok({ stock: persistedStockResult.value, stockAlertLevel: newAlertLevel });
  }
}
