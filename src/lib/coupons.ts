import { z } from "zod";
export const couponSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9_-]{3,30}$/),
  percent: z.number().min(0).max(100),
  min_total: z.number().min(0).max(100000),
  is_active: z.boolean(),
  kind: z.enum(["percent", "fixed", "shipping"]).default("percent"),
  amount: z.number().min(0).max(10000).default(0),
  expires_at: z.string().datetime().nullable().default(null),
  max_uses: z.number().int().min(0).max(100000).default(0),
  per_customer: z.number().int().min(0).max(1000).default(0),
  eligibility: z.enum(["all", "first", "recurring", "inactive"]).default("all"),
  inactive_days: z.number().int().min(1).max(365).default(30),
  product_ids: z.array(z.string().uuid()).max(500).default([]),
});
export function couponDiscount(
  c: { percent: number; kind?: string; amount?: number; product_ids?: string[] },
  items: Array<{ product_id: string; line_total: number }>,
  fee: number,
) {
  const eligible = items
    .filter((i) => !c.product_ids?.length || c.product_ids.includes(i.product_id))
    .reduce((sum, i) => sum + Math.round(i.line_total * 100), 0);
  return c.kind === "shipping"
    ? Math.round(fee * 100)
    : c.kind === "fixed"
      ? Math.min(eligible, Math.round((c.amount || 0) * 100))
      : Math.round((eligible * c.percent) / 100);
}
