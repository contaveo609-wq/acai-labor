import { z } from "zod";
import { DEFAULT_BRAND, DEFAULT_HOURS } from "./vendrex.rules";
const unit = z.enum(["unidade", "kg", "litro", "caixa", "fardo", "pacote", "combo"]);
const quantityRule = z.number().finite().min(0.001).max(1000).multipleOf(0.001);
const imageUrl = z
  .string()
  .max(1500000)
  .refine(
    (s) =>
      s.startsWith("/catalog/") ||
      s.startsWith("/images/") ||
      /^https:\/\//.test(s) ||
      /^data:image\/(png|jpeg|webp);base64,/.test(s),
    "Use imagem PNG, JPG ou WebP",
  );
const addon = z.object({
  id: z.string().uuid(),
  group_id: z.string().uuid(),
  name: z.string().trim().min(1).max(100),
  description: z.string().max(300).nullable(),
  price: z.number().finite().min(0).max(10000),
  is_active: z.boolean(),
  sort_order: z.number().int(),
});
export const productSchema = z
  .object({
    sku: z.string().trim().max(60).default(""),
    sale_unit: unit.default("unidade"),
    min_quantity: quantityRule.default(1),
    quantity_step: quantityRule.default(1),
    sale_options: z
      .array(
        z.object({
          id: z.string().uuid(),
          label: z.string().trim().min(2).max(80),
          unit,
          price: z.number().finite().min(0.01).max(100000),
          min_quantity: quantityRule,
          quantity_step: quantityRule,
          is_active: z.boolean(),
        }),
      )
      .max(12)
      .default([]),
    id: z.string().uuid(),
    category_id: z.string().uuid().nullable(),
    name: z.string().trim().min(2).max(150),
    slug: z.string().regex(/^[a-z0-9-]+$/),
    description: z.string().max(1500).nullable(),
    price: z.number().finite().min(0.01).max(100000),
    price_from: z.boolean(),
    weight: z.string().nullable(),
    quantity_label: z.string().nullable(),
    serves: z.number().int().min(1).nullable(),
    is_active: z.boolean(),
    is_sold_out: z.boolean(),
    is_featured: z.boolean(),
    featured_order: z.number().int(),
    sort_order: z.number().int(),
    product_images: z
      .array(
        z.object({
          id: z.string().uuid(),
          url: z
            .string()
            .max(1500000)
            .refine(
              (s) =>
                s.startsWith("/catalog/") ||
                /^https:\/\//.test(s) ||
                /^data:image\/(png|jpeg|webp);base64,/.test(s),
              "Use imagem PNG, JPG ou WebP",
            ),
          sort_order: z.number().int(),
          is_primary: z.boolean(),
        }),
      )
      .max(8),
    addon_groups: z
      .array(
        z
          .object({
            id: z.string().uuid(),
            title: z.string().min(2).max(120),
            min_select: z.number().int().min(0).max(30),
            max_select: z.number().int().min(1).max(30),
            is_required: z.boolean(),
            sort_order: z.number().int(),
            product_addons: z.array(addon).max(50),
          })
          .refine((g) => g.min_select <= g.max_select, "Mínimo maior que máximo"),
      )
      .max(10),
    promotions: z
      .array(
        z.object({
          id: z.string().uuid(),
          title: z.string().nullable(),
          promo_price: z.number().finite().min(0.01).nullable(),
          discount_percent: z.number().min(1).max(99).nullable(),
          starts_at: z.string().nullable(),
          ends_at: z.string().nullable(),
          is_active: z.boolean(),
        }),
      )
      .max(10),
  })
  .superRefine((p, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: "custom", message });
    const ids = [
      ...p.addon_groups.map((g) => g.id),
      ...p.addon_groups.flatMap((g) => g.product_addons.map((a) => a.id)),
      ...p.sale_options.map((o) => o.id),
    ];
    if (new Set(ids).size !== ids.length) fail("Identificadores duplicados nas opções.");
    for (const g of p.addon_groups)
      if (g.product_addons.some((a) => a.group_id !== g.id))
        fail("Adicional vinculado ao grupo errado.");
    for (const r of p.promotions) {
      if (r.promo_price != null && r.promo_price > p.price)
        fail("Preço promocional maior que o preço base.");
      if (
        (r.starts_at && !Number.isFinite(Date.parse(r.starts_at))) ||
        (r.ends_at && !Number.isFinite(Date.parse(r.ends_at)))
      )
        fail("Data de promoção inválida.");
      if (r.starts_at && r.ends_at && Date.parse(r.ends_at) < Date.parse(r.starts_at))
        fail("Fim da promoção anterior ao início.");
    }
    for (const s of [
      { unit: p.sale_unit, min_quantity: p.min_quantity, quantity_step: p.quantity_step },
      ...p.sale_options,
    ]) {
      if (
        !["kg", "litro"].includes(s.unit) &&
        (!Number.isInteger(s.min_quantity) || !Number.isInteger(s.quantity_step))
      )
        fail("Somente kg e litro aceitam quantidades fracionadas.");
    }
  });
export const categorySchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(2).max(100),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  emoji: z.string().nullable(),
  sort_order: z.number().int(),
  is_active: z.boolean(),
});
export const storeSchema = z
  .object({
    primary_color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .default(DEFAULT_BRAND.primary_color),
    accent_color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .default(DEFAULT_BRAND.accent_color),
    hero_title: z.string().trim().min(2).max(100).default(DEFAULT_BRAND.hero_title),
    hero_description: z.string().max(300).default(DEFAULT_BRAND.hero_description),
    minimum_order: z.number().finite().min(0).max(100000).default(0),
    delivery_enabled: z.boolean().default(true),
    pickup_enabled: z.boolean().default(true),
    scheduling_enabled: z.boolean().default(false),
    schedule_lead_minutes: z.number().int().min(15).max(10080).default(60),
    schedule_days: z.number().int().min(1).max(30).default(7),
    enforce_hours: z.boolean().default(false),
    weekly_hours: z
      .array(
        z.object({
          day: z.number().int().min(0).max(6),
          enabled: z.boolean(),
          opens: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
          closes: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
        }),
      )
      .length(7)
      .default(DEFAULT_HOURS),
    store_name: z.string().trim().min(2).max(100),
    tagline: z.string().max(160),
    description: z.string().max(1000),
    logo_url: imageUrl.nullable(),
    banner_url: imageUrl.nullable(),
    address_line: z.string().max(200),
    delivery_time_min: z.number().int().min(0).max(240),
    delivery_time_max: z.number().int().min(0).max(300),
    delivery_fee: z.number().finite().min(0).max(200),
    whatsapp: z.string().max(30),
    phone: z.string().max(30),
    opening_hours: z.string().max(200),
    is_open: z.boolean(),
  })
  .superRefine((s, ctx) => {
    if (
      new Set(s.weekly_hours.map((h) => h.day)).size !== 7 ||
      s.weekly_hours.some((h) => h.enabled && h.opens === h.closes)
    )
      ctx.addIssue({
        code: "custom",
        message: "Revise os sete dias e os horários de abertura/fechamento.",
      });
    if (!s.delivery_enabled && !s.pickup_enabled)
      ctx.addIssue({ code: "custom", message: "Ative entrega ou retirada." });
    if (s.delivery_time_max < s.delivery_time_min)
      ctx.addIssue({ code: "custom", message: "Prazo máximo menor que o mínimo." });
  });
export const laborOrderSchema = z
  .object({
    customer_name: z.string().trim().min(2, "Informe seu nome").max(80),
    customer_phone: z
      .string()
      .transform((s) => s.replace(/\D/g, ""))
      .refine((s) => /^\d{10,13}$/.test(s), "Telefone inválido"),
    fulfillment: z.enum(["delivery", "pickup"]),
    street: z.string().trim().max(120).default(""),
    number: z.string().trim().max(20).default(""),
    complement: z.string().max(80).nullable().optional(),
    neighborhood: z.string().trim().max(80).default(""),
    reference: z.string().max(120).nullable().optional(),
    payment_method: z.enum(["pix", "cartao", "dinheiro", "credito_entrega", "debito_entrega"]),
    scheduled_for: z.string().datetime({ offset: true }).nullable().optional(),
    change_for: z.number().finite().min(0).max(100000).nullable().optional(),
    notes: z.string().max(500).nullable().optional(),
    coupon: z.string().max(30).optional(),
    request_id: z.string().uuid(),
    expected_total: z.number().finite().min(0).optional(),
    attribution: z
      .object({
        campaign: z
          .string()
          .regex(/^[\w.-]{1,120}$/)
          .optional(),
        source: z
          .string()
          .regex(/^[\w.-]{1,120}$/)
          .optional(),
        medium: z
          .string()
          .regex(/^[\w.-]{1,120}$/)
          .optional(),
      })
      .optional(),
    items: z
      .array(
        z.object({
          product_id: z.string().uuid(),
          quantity: quantityRule,
          sale_option_id: z.string().uuid().nullable().optional(),
          notes: z.string().max(300).nullable().optional(),
          addons: z
            .array(
              z.object({ addon_id: z.string().uuid(), quantity: z.number().int().min(1).max(30) }),
            )
            .max(30),
        }),
      )
      .min(1)
      .max(40),
  })
  .superRefine((o, ctx) => {
    if (o.fulfillment === "delivery" && (!o.street || !o.number || !o.neighborhood))
      ctx.addIssue({
        code: "custom",
        message: "Preencha rua, número e bairro para entrega",
        path: ["street"],
      });
  });
export type LaborOrderInput = z.infer<typeof laborOrderSchema>;
export const STATUSES = [
  "recebido",
  "em_preparacao",
  "pronto",
  "saiu_entrega",
  "entregue",
  "concluido",
  "cancelado",
] as const;
