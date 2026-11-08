export interface StockLevel {
  sku: string;
  onHand: number;
  reserved: number;
}

export class StockService {
  private readonly levels = new Map<string, StockLevel>();

  setStock(sku: string, onHand: number): void {
    this.levels.set(sku, { sku, onHand, reserved: 0 });
  }

  /** Holds units for an order so that two customers cannot buy the last item. */
  reserveStock(sku: string, quantity: number): void {
    const level = this.levels.get(sku);
    if (!level) throw new Error(`Unknown SKU ${sku}`);
    if (level.onHand - level.reserved < quantity) {
      throw new Error('Insufficient stock for reservation');
    }
    level.reserved += quantity;
  }

  releaseStock(sku: string, quantity: number): void {
    const level = this.levels.get(sku);
    if (!level) return;
    level.reserved = Math.max(0, level.reserved - quantity);
  }

  availableUnits(sku: string): number {
    const level = this.levels.get(sku);
    return level ? level.onHand - level.reserved : 0;
  }
}
