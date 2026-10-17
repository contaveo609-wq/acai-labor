import { z } from "zod";

export const orderInputSchema = z.object({
  customer_name: z.string().trim().min(2).max(80),
  customer_phone: z.string().trim().min(8).max(20),
  street: z.string().trim().min(2).max(120),
  number: z.string().trim().min(1).max(20),
  complement: z.string().trim().max(80).optional().nullable(),
  neighborhood: z.string().trim().min(2).max(80),
  reference: z.string().trim().max(120).optional().nullable(),
  payment_method: z.enum(["pix", "cartao", "dinheiro"]),
  change_for: z.number().nonnegative().max(100000).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
  items: z
    .array(
      z.object({
        product_id: z.string().uuid(),
        quantity: z.number().int().min(1).max(50),
        notes: z.string().trim().max(300).optional().nullable(),
        addons: z
          .array(
            z.object({ addon_id: z.string().uuid(), quantity: z.number().int().min(1).max(20) }),
          )
          .max(30)
          .default([]),
      }),
    )
    .min(1)
    .max(40),
});

export type OrderInput = z.infer<typeof orderInputSchema>;

function round(value: number) {
  return Math.round(value * 100) / 100;
}

/**
 * Recalculates every price from the database. Client-sent prices are ignored.
 */
export async function createValidatedOrder(
  input: OrderInput,
  userId: string | null,
): Promise<{ id: string; order_number: number; total: number }> {
  // The old path writes items in separate transactions and is unsafe to activate.
  // Vendrex local checkout uses labor.service; a transactional remote adapter is required.
  throw new Error(
    "Checkout remoto legado desativado. Configure o adaptador transacional antes de operar online.",
  );
  /* Retained implementation for migration review:
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const productIds = [...new Set(input.items.map((i) => i.product_id))];
  const addonIds = [...new Set(input.items.flatMap((i) => i.addons.map((a) => a.addon_id)))];

  const { data: products, error: prodErr } = await supabaseAdmin
    .from("products")
    .select("id, name, price, is_active, is_sold_out, promotions(*)")
    .in("id", productIds);
  if (prodErr) throw new Error(prodErr.message);

  const { data: addons, error: addonErr } = addonIds.length
    ? await supabaseAdmin.from("product_addons").select("id, name, price, is_active").in("id", addonIds)
    : { data: [], error: null };
  if (addonErr) throw new Error(addonErr.message);

  const { data: settings } = await supabaseAdmin
    .from("store_settings")
    .select("delivery_fee, is_open")
    .maybeSingle();

  const now = Date.now();
  const priceOf = (p: {
    price: number | string;
    promotions?: Array<{
      is_active: boolean;
      promo_price: number | string | null;
      discount_percent: number | string | null;
      starts_at: string | null;
      ends_at: string | null;
    }> | null;
  }) => {
    const base = Number(p.price);
    const promo = (p.promotions ?? []).find(
      (pr) =>
        pr.is_active &&
        (!pr.starts_at || new Date(pr.starts_at).getTime() <= now) &&
        (!pr.ends_at || new Date(pr.ends_at).getTime() >= now) &&
        (pr.promo_price !== null || pr.discount_percent !== null),
    );
    if (!promo) return base;
    if (promo.promo_price !== null) return Number(promo.promo_price);
    return round(base * (1 - Number(promo.discount_percent) / 100));
  };

  let subtotal = 0;
  const resolvedItems = input.items.map((item) => {
    const product = (products ?? []).find((p) => p.id === item.product_id);
    if (!product) throw new Error("Produto não encontrado.");
    if (!product.is_active) throw new Error(`${product.name} não está disponível.`);
    if (product.is_sold_out) throw new Error(`${product.name} está esgotado no momento.`);

    const unitPrice = priceOf(product as never);
    const resolvedAddons = item.addons.map((a) => {
      const addon = (addons ?? []).find((x) => x.id === a.addon_id);
      if (!addon || !addon.is_active) throw new Error("Adicional indisponível.");
      return { addon_id: addon.id, name: addon.name, price: Number(addon.price), quantity: a.quantity };
    });

    const addonsTotal = resolvedAddons.reduce((sum, a) => sum + a.price * a.quantity, 0);
    const lineTotal = round((unitPrice + addonsTotal) * item.quantity);
    subtotal += lineTotal;

    return {
      product_id: product.id,
      product_name: product.name,
      unit_price: unitPrice,
      quantity: item.quantity,
      line_total: lineTotal,
      notes: item.notes ?? null,
      addons: resolvedAddons,
    };
  });

  subtotal = round(subtotal);
  const deliveryFee = Number(settings?.delivery_fee ?? 0);
  const total = round(subtotal + deliveryFee);

  const { data: order, error: orderErr } = await supabaseAdmin
    .from("orders")
    .insert({
      user_id: userId,
      customer_name: input.customer_name,
      customer_phone: input.customer_phone,
      street: input.street,
      number: input.number,
      complement: input.complement ?? null,
      neighborhood: input.neighborhood,
      reference: input.reference ?? null,
      payment_method: input.payment_method,
      change_for: input.change_for ?? null,
      subtotal,
      delivery_fee: deliveryFee,
      discount: 0,
      total,
      notes: input.notes ?? null,
    })
    .select("id, order_number")
    .single();
  if (orderErr || !order) throw new Error(orderErr?.message ?? "Falha ao registrar o pedido.");

  for (const item of resolvedItems) {
    const { data: created, error: itemErr } = await supabaseAdmin
      .from("order_items")
      .insert({
        order_id: order.id,
        product_id: item.product_id,
        product_name: item.product_name,
        unit_price: item.unit_price,
        quantity: item.quantity,
        line_total: item.line_total,
        notes: item.notes,
      })
      .select("id")
      .single();
    if (itemErr || !created) throw new Error(itemErr?.message ?? "Falha ao registrar itens.");

    if (item.addons.length) {
      const { error: addonInsertErr } = await supabaseAdmin.from("order_item_addons").insert(
        item.addons.map((a) => ({
          order_item_id: created.id,
          addon_id: a.addon_id,
          name: a.name,
          price: a.price,
          quantity: a.quantity,
        })),
      );
      if (addonInsertErr) throw new Error(addonInsertErr.message);
    }
  }

  try {
    await supabaseAdmin.from("notifications").insert({
      type: "order",
      title: `Novo Pedido #${order.order_number}`,
      message: `${input.customer_name} realizou um pedido no valor de R$ ${total.toFixed(2)}.`,
      link: `/admin/pedidos`,
      is_read: false,
    });
  } catch (notifErr) {
    // Non-blocking notification creation
  }

  return { id: order.id as string, order_number: order.order_number as number, total };
  */
}

export async function loadOrder(orderId: string) {
  throw new Error("Use a consulta autenticada getOrder com RLS.");
}
