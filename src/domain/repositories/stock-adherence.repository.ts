import type { Result } from '../core/result';
import type { DomainError } from '../errors/domain.errors';
import type { StockInfo } from '../entities/stock-info.entity';
import type { Treatment } from '../entities/treatment.entity';
import type { AdherenceMetrics } from '../entities/adherence-metrics.entity';

/** Puerto de manejo de inventario (CU-02 paso 6, CU-03 pasos 3-5, RF-05). */
export interface StockRepository {
  getStock(treatmentId: string): Promise<Result<StockInfo, DomainError>>;
  decrement(treatmentId: string, quantity: number): Promise<Result<StockInfo, DomainError>>;
  updateStock(treatmentId: string, newQuantity: number): Promise<Result<StockInfo, DomainError>>;
  findCriticalStockTreatments(
    caregiverId: string,
  ): Promise<Result<readonly Treatment[], DomainError>>;
}

/** Puerto de lectura de métricas de adherencia (CU-03 pasos 1-2, RF-06). */
export interface AdherenceRepository {
  getMetrics(
    treatmentId: string,
    from: Date,
    to: Date,
  ): Promise<Result<AdherenceMetrics, DomainError>>;
}
