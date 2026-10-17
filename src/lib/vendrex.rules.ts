import type { Product, StoreSettings } from "./menu";
import type { LaborDatabase, LaborOrder } from "./labor.types";

export const UNIT_LABELS: Record<string, string> = {
  unidade: "Unidade",
  kg: "Quilograma",
  litro: "Litro",
  caixa: "Caixa",
  fardo: "Fardo",
  pacote: "Pacote",
  combo: "Combo",
};
export const FINANCIAL_LABELS: Record<string, string> = {
  pendente: "Pagamento pendente",
  em_analise: "Em análise",
  pago: "Pago",
  recusado: "Recusado",
  reembolsado: "Reembolsado",
};
export const DEFAULT_HOURS = Array.from({ length: 7 }, (_, day) => ({
  day,
  enabled: true,
  opens: "09:00",
  closes: "18:00",
}));
export const DEFAULT_BRAND = {
  primary_color: "#633185",
  accent_color: "#b4cb7c",
  hero_title: "Seu dia pede um pouco de açaí.",
  hero_description: "Cremoso na medida. Sabor em cada colherada.",
};

/** Additive in-memory migration; persistence occurs inside the existing atomic write queue. */
export function migrateV2(db: LaborDatabase): LaborDatabase {
  if ((db.schema_version || 1) >= 2) return db;
  db.store = {
    ...DEFAULT_BRAND,
    minimum_order: 0,
    delivery_enabled: true,
    pickup_enabled: true,
    scheduling_enabled: false,
    schedule_lead_minutes: 60,
    schedule_days: 7,
    enforce_hours: false,
    weekly_hours: DEFAULT_HOURS.map((h) => ({ ...h })),
    ...db.store,
  };
  for (const p of db.products) {
    p.sale_unit ??= p.slug.startsWith("10-caixas")
      ? "combo"
      : p.slug.includes("picole")
        ? "pacote"
        : "unidade";
    p.min_quantity ??= 1;
    p.quantity_step ??= 1;
    p.sale_options ??= [];
    p.sku ??= "";
  }
  for (const o of db.orders) {
    // Never infer settlement from fulfillment, even for completed V1 orders.
    o.payment_status ??= "pendente";
    o.scheduled_for ??= null;
    o.internal_notes ??= [];
    o.source ??= "site";
  }
  db.audit ??= [];
  db.schema_version = 2;
  return db;
}

export function saleFor(p: Product, optionId?: string | null) {
  const option = optionId ? p.sale_options?.find((o) => o.id === optionId && o.is_active) : null;
  if (optionId && !option) throw new Error("Embalagem indisponível para este produto.");
  return (
    option || {
      id: null,
      label: UNIT_LABELS[p.sale_unit || "unidade"] || "Unidade",
      unit: p.sale_unit || "unidade",
      price: p.price,
      min_quantity: p.min_quantity ?? 1,
      quantity_step: p.quantity_step ?? 1,
    }
  );
}
export function validQuantity(quantity: number, min: number, step: number) {
  const q = Math.round(quantity * 1000),
    m = Math.round(min * 1000),
    s = Math.round(step * 1000);
  return (
    Number.isFinite(quantity) &&
    quantity > 0 &&
    quantity <= 1000 &&
    Math.abs(quantity * 1000 - q) < 1e-6 &&
    q >= m &&
    s > 0 &&
    (q - m) % s === 0
  );
}
export const lineCents = (unitCents: number, quantity: number) => Math.round(unitCents * quantity);

export function operatingAt(store: StoreSettings, date = new Date()) {
  if (!store.enforce_hours) return true;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: string) => parts.find((p) => p.type === type)?.value || "";
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(part("weekday"));
  const minutes = Number(part("hour")) * 60 + Number(part("minute"));
  const time = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3));
  const hours = store.weekly_hours || DEFAULT_HOURS;
  const today = hours.find((h) => h.day === day);
  const yesterday = hours.find((h) => h.day === (day + 6) % 7);
  if (today?.enabled) {
    const start = time(today.opens),
      end = time(today.closes);
    if (start < end && minutes >= start && minutes < end) return true;
    if (start > end && minutes >= start) return true;
  }
  return (
    !!yesterday?.enabled &&
    time(yesterday.opens) > time(yesterday.closes) &&
    minutes < time(yesterday.closes)
  );
}
export function validateFulfillment(
  store: StoreSettings,
  mode: string,
  scheduled?: string | null,
  now = new Date(),
) {
  if (!store.is_open) throw new Error("A loja está fechada para novos pedidos.");
  if (
    (mode === "delivery" && store.delivery_enabled === false) ||
    (mode === "pickup" && store.pickup_enabled === false)
  )
    throw new Error("Esta forma de recebimento está desativada.");
  let target = now;
  if (scheduled) {
    if (!store.scheduling_enabled) throw new Error("Agendamento indisponível.");
    target = new Date(scheduled);
    if (
      !Number.isFinite(target.getTime()) ||
      target.getTime() < now.getTime() + (store.schedule_lead_minutes ?? 60) * 60000 ||
      target.getTime() > now.getTime() + (store.schedule_days ?? 7) * 86400000
    )
      throw new Error("Agendamento fora do prazo permitido.");
  }
  if (!operatingAt(store, target))
    throw new Error("Fora do horário de funcionamento. Escolha um horário de atendimento.");
}
export function nextStatuses(order: Pick<LaborOrder, "status" | "fulfillment">): string[] {
  const flow: Record<string, string[]> = {
    recebido: ["em_preparacao"],
    em_preparacao: ["pronto"],
    pronto: order.fulfillment === "pickup" ? ["concluido"] : ["saiu_entrega"],
    saiu_entrega: ["entregue"],
    entregue: ["concluido"],
    concluido: [],
    cancelado: [],
  };
  const next = flow[order.status] || [];
  return ["entregue", "concluido", "cancelado"].includes(order.status)
    ? next
    : [...next, "cancelado"];
}
export function dashboardTotals(orders: LaborOrder[]) {
  const valid = orders.filter((o) => o.status !== "cancelado");
  const paid = valid.filter((o) => o.payment_status === "pago");
  const sum = (list: LaborOrder[]) => list.reduce((s, o) => s + Math.round(o.total * 100), 0) / 100;
  return {
    ordered: sum(valid),
    paid: sum(paid),
    pending: sum(
      valid.filter((o) => o.payment_status !== "pago" && o.payment_status !== "reembolsado"),
    ),
    average: valid.length ? sum(valid) / valid.length : 0,
  };
}
