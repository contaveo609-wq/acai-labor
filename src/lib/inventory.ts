import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { LaborDatabase, LaborOrder } from "./labor.types";
import type { Product } from "./menu";

export type StockRecord = { productId: string; saleOptionId: string | null; quantity: number; lowAt: number; updatedAt: string };
export type StockMovement = { id: string; at: string; productId: string; saleOptionId: string | null; delta: number; reason: "ajuste" | "pedido" | "estorno"; orderId?: string };
export const stockSchema = z.object({
  productId: z.string().uuid(),
  saleOptionId: z.string().uuid().nullable(),
  quantity: z.number().finite().min(0).max(1000000),
  lowAt: z.number().finite().min(0).max(1000000),
});
export function stockFor(db: LaborDatabase, productId: string, saleOptionId: string | null) {
  return db.inventory?.find((item) => item.productId === productId && item.saleOptionId === saleOptionId);
}
export function productUnavailable(db: LaborDatabase, product: Product) {
  if (product.is_sold_out) return true;
  const variants = [null, ...(product.sale_options || []).filter((item) => item.is_active).map((item) => item.id)];
  return variants.every((variant) => {
    const stock = stockFor(db, product.id, variant);
    return stock && stock.quantity <= 0;
  });
}
export function ensureStock(db: LaborDatabase, items: LaborOrder["order_items"]) {
  const needed = new Map<StockRecord, number>();
  for (const item of items) {
    const record = stockFor(db, item.product_id, item.sale_option_id || null);
    if (!record) continue;
    needed.set(record, (needed.get(record) || 0) + item.quantity);
  }
  for (const [record, quantity] of needed)
    if (record.quantity + 1e-8 < quantity) throw new Error("Estoque insuficiente. Revise os produtos do pedido.");
  return needed;
}
export function reserveStock(db: LaborDatabase, order: LaborOrder, needed: Map<StockRecord, number>) {
  for (const [record, quantity] of needed) {
    record.quantity = Math.max(0, Math.round((record.quantity - quantity) * 1000) / 1000);
    record.updatedAt = order.created_at;
    (db.stockMovements ??= []).push({ id: randomUUID(), at: order.created_at, productId: record.productId, saleOptionId: record.saleOptionId, delta: -quantity, reason: "pedido", orderId: order.id });
  }
}
export function restoreStock(db: LaborDatabase, order: LaborOrder) {
  const movements = (db.stockMovements || []).filter((movement) => movement.orderId === order.id && movement.reason === "pedido");
  if ((db.stockMovements || []).some((movement) => movement.orderId === order.id && movement.reason === "estorno")) return;
  for (const movement of movements) {
    const record = stockFor(db, movement.productId, movement.saleOptionId);
    if (!record) continue;
    record.quantity = Math.round((record.quantity - movement.delta) * 1000) / 1000;
    record.updatedAt = new Date().toISOString();
    db.stockMovements!.push({ id: randomUUID(), at: record.updatedAt, productId: movement.productId, saleOptionId: movement.saleOptionId, delta: -movement.delta, reason: "estorno", orderId: order.id });
  }
}
