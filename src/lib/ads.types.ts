import { z } from "zod";
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
