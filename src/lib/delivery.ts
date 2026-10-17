import { z } from "zod";
export type DeliveryDriver = { id: string; name: string; phone: string; active: boolean; feePerDelivery: number; dailyFee: number };
export type DeliveryAssignment = { orderId: string; driverId: string; assignedAt: string; deliveredAt?: string; feePerDelivery: number; dailyFee: number };
export const driverSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(2).max(100),
  phone: z.string().regex(/^\d{10,15}$/),
  active: z.boolean(),
  feePerDelivery: z.number().finite().min(0).max(1000),
  dailyFee: z.number().finite().min(0).max(10000),
});
export const assignmentSchema = z.object({ orderId: z.string().uuid(), driverId: z.string().uuid() });
