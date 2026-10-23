import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { createAdsService } from "../src/lib/ads.service";
import { createAdsTransport } from "../src/lib/ads.meta";
import { createSupportVault } from "../src/lib/support.secrets";
import { draftSchema, summarize, recommendations } from "../src/lib/ads.types";
import type { LaborDatabase } from "../src/lib/labor.types";
import { DEFAULT_SUPPORT } from "../src/lib/support.types";
import seed from "../src/data/labor-catalog.json";
process.env["LABOR_SECRET_KEY"] = Buffer.alloc(32, 8).toString("base64");
process.env["META_ADS_API_VERSION"] = "v25.0";
process.env["META_ADS_APP_ID"] = "123";
process.env["META_ADS_APP_SECRET"] = "test-app-secret";
process.env["META_ADS_REDIRECT_URI"] = "https://example.com/api/meta-ads/callback";
test("Ads: CAPI reutiliza event_id e não envia o mesmo evento duas vezes", async (t) => {
  let sent = 0,
    eventId = "";
  const h = await fixture(t, (async (_url, init) => {
    sent++;
    const items = JSON.parse(new URLSearchParams(String(init?.body)).get("data")!);
    eventId = items[0].event_id;
    assert.equal(items[0].user_data.external_id[0].length, 64);
    return Response.json({ events_received: 1 });
  }) as typeof fetch);
  process.env["META_ADS_PIXEL_ID"] = "12345";
  process.env["META_ADS_CAPI_TOKEN"] = "fake-capi-only";
  process.env["LABOR_PUBLIC_BASE_URL"] = "https://example.com";
  t.after(() => {
    delete process.env["META_ADS_PIXEL_ID"];
    delete process.env["META_ADS_CAPI_TOKEN"];
    delete process.env["LABOR_PUBLIC_BASE_URL"];
  });
  const id = randomUUID();
  await h.service.track({
    id,
    name: "PageView",
    at: new Date().toISOString(),
    visitor: randomUUID(),
    consent: true,
  });
  await h.service.dispatchConversions("admin");
  await h.service.dispatchConversions("admin");
  assert.equal(eventId, id);
  assert.equal(sent, 1);
});
test("Ads: cota semanal reserva três sugestões antes de chamadas concorrentes", async (t) => {
  let calls = 0;
  const h = await fixture(t, (async () => {
    calls++;
    return Response.json({
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  suggestions: Array.from({ length: 3 }, () => ({
                    text: "Catálogo da loja",
                    headline: "Açaí Labor",
                    cta: "Ver produto",
                  })),
                }),
              },
            ],
          },
        },
      ],
    });
  }) as typeof fetch);
  await createSupportVault(h.directory).replace("fake-gemini-only");
  h.db.support = {
    config: { ...DEFAULT_SUPPORT, model: "models/test" },
    conversations: [],
    usage: [],
  };
  const results = await Promise.allSettled([
    h.service.suggest("admin", h.db.products[0]!.id, false),
    h.service.suggest("admin", h.db.products[0]!.id, false),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(calls, 1);
  await h.service.suggest("admin", h.db.products[0]!.id, true);
  assert.equal(calls, 2);
});
test("Ads: migration isola lojas e navegador não escreve orçamento", async () => {
  const sql = new PGlite();
  try {
    await sql.exec(
      "create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;",
    );
    await sql.exec(
      await readFile("supabase/migrations/20261023090000_labor_paid_media.sql", "utf8"),
    );
    const user = randomUUID(),
      id = randomUUID();
    await sql.query("insert into auth.users values($1)", [user]);
    await sql.exec("insert into public.labor_ads_stores(id,name)values('a','A'),('b','B')");
    await sql.query("insert into public.labor_ads_members values('a',$1,'owner')", [user]);
    await sql.query(
      "insert into public.labor_ads_drafts(id,store_id,product_id,name,objective,budget_kind,budget_cents,starts_at,ends_at) values($1,'b',$2,'Outra loja','OUTCOME_TRAFFIC','daily',2000,now(),now()+interval '1 day')",
      [id, randomUUID()],
    );
    await sql.exec(`set role authenticated;set request.jwt.claim.sub='${user}'`);
    assert.equal((await sql.query("select * from public.labor_ads_drafts")).rows.length, 0);
    await assert.rejects(
      sql.exec("update public.labor_ads_drafts set budget_cents=1"),
      /permission denied/,
    );
  } finally {
    await sql.close();
  }
});
async function fixture(
  t: { after: (fn: () => Promise<void>) => void },
  request: typeof fetch = (async () => Response.json({ id: "999" })) as typeof fetch,
) {
  const directory = await mkdtemp(join(tmpdir(), "labor-ads-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const db = structuredClone(seed) as unknown as LaborDatabase;
  let queue: Promise<unknown> = Promise.resolve();
  const service = createAdsService(
    {
      directory,
      storeId: "acai-labor",
      read: async () => structuredClone(db),
      mutate: (fn) => {
        const r = queue.then(() => fn(db));
        queue = r.catch(() => {});
        return r;
      },
      requireAdmin: (token) => {
        if (token !== "admin") throw Error("Não autorizado");
      },
      requireSensitive: (token) => {
        if (token !== "admin") throw Error("MFA necessário");
      },
      audit: (db, action, resource_id, detail) => {
        (db.audit ??= []).push({
          id: randomUUID(),
          at: new Date().toISOString(),
          actor: "admin",
          action,
          resource_id,
          detail,
        });
      },
    },
    request,
  );
  await createSupportVault(directory, "meta-ads").replace("test-secret-only");
  const input = () => ({
    name: "Açaí teste",
    productId: db.products[0]!.id,
    objective: "OUTCOME_TRAFFIC",
    budgetKind: "daily",
    budget: 20,
    start: new Date(Date.now() + 86400000).toISOString(),
    end: new Date(Date.now() + 7 * 86400000).toISOString(),
    country: "BR",
    cityId: "12345",
    ageMin: 18,
    ageMax: 65,
    placements: ["facebook"],
    audience: "Região da loja",
  });
  return { service, db, directory, input };
}
test("Ads: snapshot exige admin e não retorna token", async (t) => {
  const h = await fixture(t);
  await assert.rejects(h.service.snapshot(), /autorizado/);
  assert.ok(!JSON.stringify(await h.service.snapshot("admin")).includes("test-secret-only"));
  assert.ok(
    !(await readFile(join(h.directory, "meta-ads-secret.json"), "utf8")).includes(
      "test-secret-only",
    ),
  );
});
test("Ads: orçamento, datas e produto indisponível são rejeitados", async (t) => {
  const h = await fixture(t);
  assert.equal(draftSchema.safeParse({ ...h.input(), budget: -1 }).success, false);
  assert.equal(draftSchema.safeParse({ ...h.input(), end: h.input().start }).success, false);
  await assert.rejects(
    h.service.save("admin", { ...h.input(), productId: randomUUID() }),
    /indisponível/,
  );
});
test("Ads: atualização de rascunho preserva ID e não duplica", async (t) => {
  const h = await fixture(t);
  const id = await h.service.save("admin", h.input());
  await h.service.save("admin", { ...h.input(), id, name: "Alterado" });
  assert.equal(h.db.ads?.drafts.length, 1);
  assert.equal(h.db.ads?.drafts[0]?.name, "Alterado");
});
test("Ads: seleção exige conta autorizada em BRL", async (t) => {
  const h = await fixture(t);
  h.db.ads = {
    drafts: [],
    campaigns: [],
    insights: [],
    creatives: [],
    events: [],
    jobs: [],
    accounts: [{ id: "act_123", name: "USD", currency: "USD" }],
  };
  await assert.rejects(h.service.selectAccount("admin", "act_123"), /BRL/);
});
test("Ads: publicação exige confirmação, cria pausada e impede duplicação", async (t) => {
  let calls = 0;
  const h = await fixture(t, (async (_url, init) => {
    calls++;
    assert.equal(new URLSearchParams(String(init?.body)).get("status"), "PAUSED");
    return Response.json({ id: "1234" });
  }) as typeof fetch);
  const id = await h.service.save("admin", h.input());
  h.db.ads!.account = "act_123";
  h.db.ads!.accounts = [{ id: "act_123", name: "Loja", currency: "BRL" }];
  await assert.rejects(h.service.publish("admin", id, false), /Confirme/);
  await h.service.publish("admin", id, true);
  await assert.rejects(h.service.publish("admin", id, true), /já enviada/);
  assert.equal(calls, 1);
});
test("Ads: timeout financeiro bloqueia reenvio e preserva auditoria", async (t) => {
  const h = await fixture(t, (async () => {
    throw Error("token não pode vazar");
  }) as typeof fetch);
  const id = await h.service.save("admin", h.input());
  h.db.ads!.account = "act_123";
  h.db.ads!.accounts = [{ id: "act_123", name: "Loja", currency: "BRL" }];
  await assert.rejects(h.service.publish("admin", id, true), /incerto/);
  assert.equal(h.db.ads!.drafts[0]?.state, "uncertain");
  await assert.rejects(h.service.publish("admin", id, true), /já enviada/);
});
test("Ads: OAuth rejeita state incorreto e sessão diferente", async (t) => {
  const h = await fixture(t);
  const r = await h.service.connect("admin"),
    state = new URL(r.url).searchParams.get("state")!;
  await assert.rejects(h.service.callback("admin", "code", "a".repeat(64)), /expirado/);
  h.db.ads!.oauth!.session = "wrong";
  await assert.rejects(h.service.callback("admin", "code", state), /sessão/);
});
test("Ads: métricas vazias não inventam ROAS; recomendações exigem amostra", () => {
  assert.equal(summarize([]).roas, null);
  assert.equal(recommendations([]).length, 0);
  const r = {
    campaignId: "1",
    name: "teste",
    date: "2026-10-23",
    currency: "BRL",
    spend: 100,
    impressions: 2000,
    reach: 1000,
    clicks: 1,
    purchases: 0,
    revenue: 0,
  };
  assert.equal(recommendations([r]).length, 3);
});
test("Ads: transporte mascara erro, usa cabeçalho e bloqueia redirect", async () => {
  const call = createAdsTransport((async (url, init) => {
    assert.ok(!String(url).includes("test-token"));
    assert.equal(init?.redirect, "error");
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer test-token");
    return new Response("test-token", { status: 429 });
  }) as typeof fetch);
  await assert.rejects(call("me/adaccounts", "test-token"), /Limite da Meta/);
});
test("Ads: eventos exigem consentimento, não aceitam Purchase do cliente e deduplicam", async (t) => {
  const h = await fixture(t);
  const input = {
    id: randomUUID(),
    visitor: randomUUID(),
    name: "PageView",
    at: new Date().toISOString(),
    consent: true,
  };
  await assert.rejects(h.service.track({ ...input, consent: false }));
  await assert.rejects(h.service.track({ ...input, name: "Purchase" }));
  await Promise.all([h.service.track(input), h.service.track(input)]);
  assert.equal(h.db.ads!.events.length, 1);
  assert.equal(h.db.ads!.events[0]!.visitorHash?.length, 64);
  assert.ok(!JSON.stringify(h.db.ads).includes(input.visitor));
});
test("Ads: conjunto converte orçamento BRL para centavos e fica pausado", async (t) => {
  const calls: { path: string; body: URLSearchParams }[] = [];
  const h = await fixture(t, (async (url, init) => {
    calls.push({
      path: new URL(String(url)).pathname,
      body: new URLSearchParams(String(init?.body)),
    });
    return Response.json({ id: String(1000 + calls.length) });
  }) as typeof fetch);
  const id = await h.service.save("admin", h.input());
  h.db.ads!.account = "act_123";
  h.db.ads!.accounts = [{ id: "act_123", name: "Loja", currency: "BRL" }];
  await h.service.publish("admin", id, true);
  await h.service.prepareAd("admin", { id, postId: "12_34", confirm: true });
  assert.equal(calls.find((v) => v.path.endsWith("/adsets"))?.body.get("daily_budget"), "2000");
  assert.equal(calls.find((v) => v.path.endsWith("/ads"))?.body.get("status"), "PAUSED");
  await assert.rejects(
    h.service.prepareAd("admin", { id, postId: "12_34", confirm: true }),
    /já iniciada/,
  );
});
