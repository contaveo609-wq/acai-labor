import { z } from "zod";
import type { LaborOrder } from "./labor.types";
export const objectives = [
  "OUTCOME_TRAFFIC",
  "OUTCOME_SALES",
  "OUTCOME_ENGAGEMENT",
  "OUTCOME_AWARENESS",
  "OUTCOME_LEADS",
] as const;
export const draftSchema = z
  .object({
    id: z.string().uuid().optional(),
    name: z.string().trim().min(3).max(120),
    productId: z.string().uuid(),
    objective: z.enum(objectives),
    budgetKind: z.enum(["daily", "lifetime"]),
    budget: z.number().finite().min(1).max(10000),
    start: z.string().datetime({ offset: true }),
    end: z.string().datetime({ offset: true }),
    country: z
      .string()
      .regex(/^[A-Z]{2}$/)
      .default("BR"),
    cityId: z.string().regex(/^\d+$/).optional(),
    ageMin: z.number().int().min(18).max(65).default(18),
    ageMax: z.number().int().min(18).max(65).default(65),
    placements: z
      .array(z.enum(["facebook", "instagram"]))
      .min(1)
      .default(["facebook", "instagram"]),
    audience: z.string().max(500).default(""),
  })
  .refine(
    (v) => Date.parse(v.end) > Date.parse(v.start) && v.ageMax >= v.ageMin,
    "Revise período e idades.",
  );
export type AdsDraft = z.infer<typeof draftSchema> & {
  id: string;
  metaId?: string;
  account?: string;
  adsetId?: string;
  creativeId?: string;
  adId?: string;
  state: "draft" | "publishing" | "published" | "uncertain";
  updated: string;
};
export type Insight = {
  campaignId: string;
  name: string;
  date: string;
  currency: string;
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  purchases: number;
  revenue: number;
};
export type AdsState = {
  account?: string;
  accounts?: { id: string; name: string; currency: string }[];
  oauth?: { hash: string; session: string; expires: number };
  drafts: AdsDraft[];
  campaigns: { id: string; name: string; status: string; objective: string }[];
  insights: Insight[];
  synced?: string;
  ads?: { id: string; name: string; status: string; effective_status: string }[];
  creatives: {
    id: string;
    at: string;
    productId: string;
    suggestions: { text: string; headline: string; cta: string }[];
  }[];
  events: {
    id: string;
    name: string;
    at: string;
    campaign?: string;
    productId?: string;
    visitorHash?: string;
    value?: number;
    currency: "BRL";
    source: "browser" | "server";
    delivered?: boolean;
    dispatch?: "sending" | "uncertain";
  }[];
  jobs: { id: string; resource: string; state: "pending" | "done" | "uncertain" }[];
};
export function adsState(db: { ads?: AdsState }): AdsState {
  return (db.ads ??= {
    drafts: [],
    campaigns: [],
    insights: [],
    creatives: [],
    events: [],
    jobs: [],
  });
}
export const trackingSchema = z.object({
  id: z.string().uuid(),
  name: z.enum(["PageView", "ViewContent", "AddToCart", "InitiateCheckout"]),
  at: z.string().datetime(),
  campaign: z
    .string()
    .regex(/^[\w.-]{1,120}$/)
    .optional(),
  productId: z.string().uuid().optional(),
  visitor: z.string().uuid(),
  consent: z.literal(true),
});
export function summarize(rows: Insight[]) {
  const total = rows.reduce(
    (a, r) => ({
      spend: a.spend + r.spend,
      impressions: a.impressions + r.impressions,
      clicks: a.clicks + r.clicks,
      purchases: a.purchases + r.purchases,
      revenue: a.revenue + r.revenue,
    }),
    { spend: 0, impressions: 0, clicks: 0, purchases: 0, revenue: 0 },
  );
  return {
    ...total,
    ctr: total.impressions ? (total.clicks / total.impressions) * 100 : null,
    cpc: total.clicks ? total.spend / total.clicks : null,
    cpm: total.impressions ? (total.spend / total.impressions) * 1000 : null,
    cpa: total.purchases ? total.spend / total.purchases : null,
    roas: total.spend ? total.revenue / total.spend : null,
  };
}
export function recommendations(rows: Insight[], targetRoas = 3, maxCpa = 20) {
  return [...new Set(rows.map((r) => r.campaignId))].flatMap((id) => {
    const data = rows.filter((r) => r.campaignId === id),
      t = summarize(data),
      notes: string[] = [];
    if (t.impressions >= 1000 && (t.ctr ?? 0) < 1)
      notes.push("CTR abaixo de 1% após 1.000 impressões: revise criativo e público.");
    if (t.spend >= maxCpa * 2 && (!t.purchases || (t.cpa ?? 0) > maxCpa))
      notes.push("Custo por compra acima da meta: revise oferta antes de ampliar orçamento.");
    if (t.spend > 0 && (t.roas ?? 0) < targetRoas)
      notes.push(`ROAS abaixo da meta ${targetRoas}: confira atribuição e margem.`);
    const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
    if (sorted.length >= 6) {
      const a = summarize(sorted.slice(-6, -3)),
        b = summarize(sorted.slice(-3));
      if (a.ctr && b.ctr !== null && b.ctr < a.ctr * 0.7)
        notes.push("CTR caiu mais de 30% nos últimos três registros: teste outra variação.");
    }
    return notes.map((reason) => ({ campaignId: id, reason, approvalRequired: true }));
  });
}

export function paidCommerce(orders: LaborOrder[]) {
  const paid = orders.filter(
    (o) => !o.is_test && o.payment_status === "pago" && o.status !== "cancelado",
  );
  const products = new Map<
    string,
    { id: string; name: string; units: number; revenue: number; orders: number }
  >();
  const campaigns = new Map<string, { name: string; orders: number; revenue: number }>();
  for (const order of paid) {
    const campaign = order.attribution?.campaign;
    if (campaign) {
      const row = campaigns.get(campaign) || { name: campaign, orders: 0, revenue: 0 };
      row.orders++;
      row.revenue += order.total;
      campaigns.set(campaign, row);
    }
    for (const item of order.order_items) {
      const row = products.get(item.product_id) || {
        id: item.product_id,
        name: item.product_name,
        units: 0,
        revenue: 0,
        orders: 0,
      };
      row.units += item.quantity;
      row.revenue += item.line_total;
      row.orders++;
      products.set(item.product_id, row);
    }
  }
  return {
    paidOrders: paid.length,
    revenue: paid.reduce((sum, order) => sum + order.total, 0),
    average: paid.length ? paid.reduce((sum, order) => sum + order.total, 0) / paid.length : null,
    products: [...products.values()].sort((a, b) => b.revenue - a.revenue),
    campaigns: [...campaigns.values()].sort((a, b) => b.orders - a.orders),
  };
}

export function evidenceRecommendations(rows: Insight[], targetRoas = 3, maxCpa = 20) {
  return [...new Set(rows.map((row) => row.campaignId))].flatMap((id) => {
    const sample = rows.filter((row) => row.campaignId === id);
    const result = summarize(sample);
    const confidence =
      sample.length >= 7 && result.purchases >= 10
        ? "alta"
        : sample.length >= 3 && result.impressions >= 1000
          ? "moderada"
          : "baixa";
    const findings: {
      campaignId: string;
      name: string;
      reason: string;
      evidence: string;
      confidence: string;
      risk: string;
      approvalRequired: true;
    }[] = [];
    const add = (reason: string, risk: string) =>
      findings.push({
        campaignId: id,
        name: sample[0]?.name || id,
        reason,
        evidence: `${sample.length} dia(s), ${result.impressions} impressões, ${result.clicks} cliques, R$ ${result.spend.toFixed(2)} gastos, ${result.purchases} compras reportadas pela Meta.`,
        confidence,
        risk,
        approvalRequired: true,
      });
    if (result.impressions >= 1000 && result.ctr !== null && result.ctr < 1)
      add(
        `CTR de ${result.ctr.toFixed(2)}%: revise o anúncio e o público.`,
        "Trocar o anúncio pode reduzir resultados durante a fase de aprendizado.",
      );
    if (
      result.spend >= maxCpa * 2 &&
      (!result.purchases || (result.cpa !== null && result.cpa > maxCpa))
    )
      add(
        `CPA ${result.cpa === null ? "indisponível" : `R$ ${result.cpa.toFixed(2)}`} acima da meta R$ ${maxCpa.toFixed(2)}: avalie pausar após revisão.`,
        "A atribuição da Meta pode divergir dos pedidos pagos internamente.",
      );
    if (
      result.purchases >= 3 &&
      result.spend > 0 &&
      result.roas !== null &&
      result.roas < targetRoas
    )
      add(
        `ROAS ${result.roas.toFixed(2)}× abaixo da meta ${targetRoas.toFixed(2)}×: revise oferta e segmentação.`,
        "ROAS usa receita atribuída pela Meta e não representa lucro.",
      );
    if (
      result.purchases >= 10 &&
      sample.length >= 7 &&
      result.roas !== null &&
      result.roas >= targetRoas &&
      result.cpa !== null &&
      result.cpa <= maxCpa
    )
      add(
        "Resultados superam as metas; considere testar aumento de orçamento de até 10%, com aprovação.",
        "Aumentar o orçamento pode elevar o CPA; resultados passados não garantem os próximos.",
      );
    return findings;
  });
}
