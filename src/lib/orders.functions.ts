import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { orderInputSchema, type OrderInput } from "./orders.server";
import { z } from "zod";

export const placeGuestOrder = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => orderInputSchema.parse(data))
  .handler(async ({ data }) => {
    const { createValidatedOrder } = await import("./orders.server");
    return createValidatedOrder(data as OrderInput, null);
  });

export const placeUserOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => orderInputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { createValidatedOrder } = await import("./orders.server");
    return createValidatedOrder(data as OrderInput, context.userId);
  });

export const getOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: order, error } = await context.supabase
      .from("orders")
      .select("*, order_items(*, order_item_addons(*))")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error("Não foi possível consultar o pedido.");
    return order;
  });
