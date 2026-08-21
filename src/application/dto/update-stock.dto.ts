import type { StockInfo, StockAlertLevel } from '../../domain';

export interface UpdateStockInput {
  readonly treatmentId: string;
  readonly requestingCaregiverId: string;
  readonly newQuantity: number;
}

export interface UpdateStockOutput {
  readonly stock: StockInfo;
  readonly stockAlertLevel: StockAlertLevel;
}
