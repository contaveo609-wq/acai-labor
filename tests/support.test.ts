import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { createLaborService } from "../src/lib/labor.service";
import { createSupportService, supportPrice } from "../src/lib/support.service";
import { createGeminiProvider } from "../src/lib/support.gemini";
import { createSupportVault } from "../src/lib/support.secrets";
import { DEFAULT_SUPPORT, type SupportDecision } from "../src/lib/support.types";
import type { LaborDatabase } from "../src/lib/labor.types";
import seed from "../src/data/labor-catalog.json";

// CI has no interactive Windows profile for DPAPI. The production default on
// Windows remains DPAPI; the test suite exercises the server-key AES-GCM path.
process.env["LABOR_SECRET_KEY"] ??= Buffer.alloc(32, 7).toString("base64");

const decision = (patch: Partial<SupportDecision> = {}): SupportDecision => ({
  action: "products",
  query: "",
  productIds: [],
  quantity: 1,
  orderId: "",
  ...patch,
});
async function harness(
  t: TestContext,
  decide?: Parameters<typeof createSupportService>[0]["decide"],
) {
  const directory = await mkdtemp(join(tmpdir(), "labor-support-"));
  t.after(async () => {
    assert.equal(dirname(directory), tmpdir());
    await rm(directory, { recursive: true, force: true });
  });
  let db = structuredClone(seed) as unknown as LaborDatabase;
  db.support = {
    config: { ...DEFAULT_SUPPORT, geminiEnabled: !!decide, model: "models/test-model" },
    conversations: [],
    usage: [],
  };
  let queue: Promise<unknown> = Promise.resolve();
  const service = createSupportService({
    directory,
    read: async () => structuredClone(db),
    mutate: (fn) => {
      const operation = queue.then(async () => {
        const copy = structuredClone(db);
        const result = await fn(copy);
        db = copy;
        return result;
      });
      queue = operation.catch(() => {});
      return operation;
    },
    requireAdmin: (token) => {
      if (token !== "admin") throw new Error("não autorizado");
    },
    audit: (db, action, resource_id, detail) => {
      (db.audit ??= []).push({
        id: randomUUID(),
        at: new Date().toISOString(),
        actor: "test",
        action,
        resource_id,
        detail,
      });
    },
    ...(decide ? { decide } : {}),
  });
  const opened = await service.open("alice");
  assert.ok(opened.conversation);
  return {
    service,
    id: opened.conversation.id,
    db: () => db,
    directory,
    send: (text: string) => service.send("alice", opened.conversation!.id, randomUUID(), text),
  };
}

test("histórico persiste após reiniciar serviço; dono, admin e loja são verificados", async (t) => {
  const h = await harness(t);
  await assert.rejects(h.service.get("bob", h.id), /não encontrada/);
  await assert.rejects(h.service.send("bob", h.id, randomUUID(), "oi"), /não encontrada/);
  await assert.rejects(h.service.inbox(), /não autorizado/);
  await assert.rejects(h.service.config("fake"), /não autorizado/);
  await assert.rejects(h.service.control("fake", h.id, "claim"), /não autorizado/);
  h.db().support!.conversations[0]!.storeId = "outra-loja";
  await assert.rejects(h.service.get("alice", h.id), /não encontrada/);
  assert.equal((await h.service.inbox("admin")).length, 0);
  const original = createLaborService(h.directory);
  const c = (await original.support.open("visitor"))!.conversation!;
  await original.support.send("visitor", c.id, randomUUID(), "Horários");
  const restarted = createLaborService(h.directory);
  assert.equal((await restarted.support.get("visitor", c.id)).messages.length, 3);
  const dto = JSON.stringify(await restarted.support.get("visitor", c.id));
  assert.ok(!dto.includes("ownerHash") && !dto.includes("storeId"));
});

test("122 produtos reais: preço, promoção, disponibilidade e seleção de carrinho", async (t) => {
  const h = await harness(t);
  assert.equal(h.db().products.length, 122);
  const p = h
    .db()
    .products.find(
      (p) =>
        p.is_active &&
        !p.is_sold_out &&
        !p.addon_groups.some((g) => g.is_required || g.min_select > 0),
    )!;
  const result = await h.send(p.name);
  const reply = result.messages.at(-1)!;
  assert.ok(reply.cards?.some((c) => c.id === p.id));
  assert.equal(reply.cards!.find((c) => c.id === p.id)!.price, supportPrice(p));
  const item = await h.service.cart("alice", h.id, reply.id, p.id);
  assert.equal(item.unitPrice, supportPrice(p));
  await assert.rejects(h.service.cart("bob", h.id, reply.id, p.id), /não encontrada/);
  await assert.rejects(h.service.cart("alice", h.id, randomUUID(), p.id), /Sugestão/);
  const changed = h.db().products.find((x) => x.id === p.id)!;
  changed.price += 10;
  changed.promotions = [];
  await assert.rejects(h.service.cart("alice", h.id, reply.id, p.id), /Preço atualizado/);
  changed.is_sold_out = true;
  await assert.rejects(h.service.cart("alice", h.id, reply.id, p.id), /disponibilidade/);
});

test("consulta não publica produtos arquivados, categorias ocultas nem falsas promoções", async (t) => {
  const h = await harness(t);
  const p = h.db().products[0]!;
  p.is_active = false;
  const response = await h.send(p.name);
  assert.ok(!response.messages.flatMap((m) => m.cards || []).some((c) => c.id === p.id));
  p.is_active = true;
  h.db().categories.find((c) => c.id === p.category_id)!.is_active = false;
  assert.ok(!(await h.send(p.name)).messages.at(-1)!.cards?.some((c) => c.id === p.id));
  const offers = await h.send("Ofertas");
  for (const card of offers.messages.at(-1)!.cards || [])
    assert.ok(card.price < h.db().products.find((p) => p.id === card.id)!.price);
});

test("repetição idempotente não duplica resposta e rejeita conteúdo alterado", async (t) => {
  let calls = 0;
  const h = await harness(t, async () => {
    calls++;
    return { decision: decision(), tokens: 12 };
  });
  const messageId = randomUUID();
  const [first, second] = await Promise.all([
    h.service.send("alice", h.id, messageId, "Produtos"),
    h.service.send("alice", h.id, messageId, "Produtos"),
  ]);
  assert.equal(calls, 1);
  assert.equal(
    (await h.service.get("alice", h.id)).messages.filter((m) => m.role === "customer").length,
    1,
  );
  assert.equal(first.id, second.id);
  await assert.rejects(h.service.send("alice", h.id, messageId, "Outro conteúdo"), /Identificador/);
});

test("assumir e reativar durante requisição descarta resposta antiga", async (t) => {
  let finish!: (value: { decision: SupportDecision; tokens: number }) => void;
  let began!: () => void;
  const started = new Promise<void>((resolve) => {
    began = resolve;
  });
  const h = await harness(t, () => {
    began();
    return new Promise((resolve) => {
      finish = resolve;
    });
  });
  const pending = h.send("Produtos");
  await started;
  await assert.rejects(h.send("Outra mensagem"), /Aguarde/);
  await h.service.control("admin", h.id, "claim");
  await h.service.reply("admin", h.id, randomUUID(), "Olá, equipe Labor aqui.");
  await h.service.control("admin", h.id, "resume");
  finish({ decision: decision(), tokens: 33 });
  await pending;
  const c = await h.service.get("alice", h.id);
  assert.equal(c.messages.filter((m) => m.role === "assistant").length, 1);
  assert.equal(h.db().support!.usage[0]!.discarded, 1);
  assert.equal(h.db().support!.usage[0]!.tokens, 33);
});

test("pedido de atendente interrompe resposta em andamento e permite resposta humana", async (t) => {
  let finish!: (value: { decision: SupportDecision; tokens: number }) => void;
  let began!: () => void;
  const started = new Promise<void>((resolve) => {
    began = resolve;
  });
  const h = await harness(t, () => {
    began();
    return new Promise((resolve) => {
      finish = resolve;
    });
  });
  const pending = h.send("Produtos");
  await started;
  await h.service.handoff("alice", h.id);
  finish({ decision: decision(), tokens: 2 });
  await pending;
  await assert.rejects(h.service.reply("admin", h.id, randomUUID(), "Olá"), /Assuma/);
  await h.service.control("admin", h.id, "claim");
  const messageId = randomUUID();
  await h.service.reply("admin", h.id, messageId, "Resposta humana");
  await h.service.reply("admin", h.id, messageId, "Resposta humana");
  const c = await h.send("Obrigado");
  assert.equal(c.mode, "human");
  assert.equal(c.messages.filter((m) => m.text === "Resposta humana").length, 1);
  assert.equal(c.messages.filter((m) => m.role === "assistant").length, 1);
});

test("memória transmite somente cinco mensagens e resumo de IDs validados", async (t) => {
  const contexts: string[] = [];
  const h = await harness(t, async (input) => {
    contexts.push(input.context);
    return {
      decision: decision({ action: "product", productIds: [seed.products[0]!.id] }),
      tokens: 4,
    };
  });
  for (let n = 0; n < 4; n++) await h.send(`Mensagem ${n}`);
  const last = JSON.parse(contexts.at(-1)!);
  assert.equal(last.messages.length, 5);
  assert.ok(!last.messages.some((m: { text: string }) => m.text === "Mensagem 0"));
  assert.deepEqual(last.summary.productIds, [seed.products[0]!.id]);
  assert.deepEqual(Object.keys(last.summary).sort(), ["action", "productIds", "quantity"]);
});

test("Gemini indisponível, limite, JSON inválido e ação proibida encaminham para humano", async (t) => {
  for (const response of ["network", "invalid", "forbidden"]) {
    const h = await harness(t, async () => {
      if (response === "network") throw new Error("HTTP 429 secret-never-log");
      return {
        decision: {
          action: response === "forbidden" ? "confirm_payment" : "product",
          productIds: ["not-a-uuid"],
        } as unknown as SupportDecision,
        tokens: 1,
      };
    });
    const result = await h.send("Consulta");
    assert.equal(result.mode, "waiting");
    assert.equal(h.db().support!.usage[0]!.errors, 1);
    assert.ok(!JSON.stringify(h.db()).includes("secret-never-log"));
    assert.deepEqual(h.db().orders, seed.orders);
  }
});

test("limites diários são reservados antes de chamadas concorrentes", async (t) => {
  let calls = 0;
  const h = await harness(t, async () => {
    calls++;
    return { decision: decision(), tokens: 1 };
  });
  h.db().support!.config.dailyLimit = 1;
  const bob = (await h.service.open("bob")).conversation!;
  await Promise.all([h.send("Produtos"), h.service.send("bob", bob.id, randomUUID(), "Produtos")]);
  assert.equal(calls, 1);
  assert.equal(h.db().support!.usage[0]!.requests, 1);
  assert.equal(h.db().support!.conversations.filter((c) => c.mode === "waiting").length, 1);
});

test("limite por minuto do chatbot do site bloqueia conversas simultâneas", async (t) => {
  let calls = 0;
  const h = await harness(t, async () => {
    calls++;
    return { decision: decision(), tokens: 1 };
  });
  h.db().support!.config.siteMinuteLimit = 1;
  const bob = (await h.service.open("bob")).conversation!;
  await Promise.all([h.send("Produtos"), h.service.send("bob", bob.id, randomUUID(), "Produtos")]);
  assert.equal(calls, 1);
  assert.equal(h.db().support!.usage[0]!.siteRequests, 1);
  assert.equal(h.db().support!.conversations.filter((c) => c.mode === "waiting").length, 1);
});

test("consulta de pedido requer o mesmo visitante da compra", async (t) => {
  const h = await harness(t);
  const real = createLaborService(h.directory);
  const p = (await real.catalog()).products.find((p) => !p.is_sold_out && !p.addon_groups.length)!;
  const order = await real.place(
    {
      request_id: randomUUID(),
      customer_name: "Cliente Teste",
      customer_phone: "11999990000",
      fulfillment: "pickup",
      street: "",
      number: "",
      neighborhood: "",
      payment_method: "pix",
      items: [{ product_id: p.id, quantity: p.min_quantity || 1, addons: [] }],
    },
    "alice",
  );
  const alice = (await real.support.open("alice")).conversation!;
  const bob = (await real.support.open("bob")).conversation!;
  assert.match(
    (await real.support.send("alice", alice.id, randomUUID(), `Pedido ${order.id}`)).messages.at(
      -1,
    )!.text,
    /Pagamento: pendente/,
  );
  assert.match(
    (await real.support.send("bob", bob.id, randomUUID(), `Pedido ${order.id}`)).messages.at(-1)!
      .text,
    /Nenhum pedido autorizado/,
  );
});

test("retém 30 dias, limita mensagens e não ativa IA sem teste", async (t) => {
  const h = await harness(t);
  await assert.rejects(
    h.service.saveConfig("admin", { ...DEFAULT_SUPPORT, geminiEnabled: true }),
    /Teste o modelo/,
  );
  for (let n = 0; n < 10; n++) await h.send("Oi");
  await assert.rejects(h.send("Oi"), /Muitas mensagens/);
  h.db().support!.conversations[0]!.updatedAt = new Date(Date.now() - 31 * 86400000).toISOString();
  await assert.rejects(h.service.get("alice", h.id), /não encontrada/);
  const next = (await h.service.open("alice")).conversation!;
  assert.notEqual(next.id, h.id);
  assert.equal(h.db().support!.conversations.length, 1);
});

test("adaptador Gemini usa cabeçalho secreto, paginação, DTO e valida saída", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fakeFetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    if (url.includes("generateContent"))
      return Response.json({
        candidates: [
          { finishReason: "STOP", content: { parts: [{ text: JSON.stringify(decision()) }] } },
        ],
        usageMetadata: { totalTokenCount: 9 },
      });
    return Response.json(
      calls.length === 1
        ? {
            models: [
              {
                name: "models/a",
                displayName: "A",
                supportedGenerationMethods: ["generateContent"],
                extra: "must-not-return",
              },
            ],
            nextPageToken: "page2",
          }
        : { models: [{ name: "models/embedding", supportedGenerationMethods: ["embedContent"] }] },
    );
  }) as typeof fetch;
  const provider = createGeminiProvider(async () => "secret-test-key", fakeFetch);
  assert.deepEqual(await provider.models(), [{ name: "models/a", displayName: "A" }]);
  const result = await provider.decide({ model: "models/a", context: "untrusted" });
  assert.equal(result.tokens, 9);
  assert.ok(calls.every((c) => !c.url.includes("secret-test-key")));
  assert.ok(calls[1]!.url.includes("pageToken=page2"));
  assert.equal(
    (calls[0]!.init!.headers as Record<string, string>)["x-goog-api-key"],
    "secret-test-key",
  );
  const denied = createGeminiProvider(
    async () => "secret-test-key",
    (async () => new Response("sensitive-provider-body", { status: 429 })) as typeof fetch,
  );
  await assert.rejects(denied.models(), /Limite do Gemini atingido/);
  const broken = createGeminiProvider(async () => "secret-test-key", (async () =>
    Response.json({ candidates: [{ finishReason: "MAX_TOKENS" }] })) as typeof fetch);
  await assert.rejects(broken.decide({ model: "models/a", context: "" }), /incompleta/);
});

test("cofre guarda chave cifrada e painel não devolve segredo", async (t) => {
  const h = await harness(t);
  const fakeKey = "example-only-never-a-real-api-key-12345";
  await h.service.replaceKey("admin", fakeKey);
  const raw = await readFile(join(h.directory, "gemini-secret.json"), "utf8");
  assert.ok(!raw.includes(fakeKey));
  assert.equal(await createSupportVault(h.directory).get(), fakeKey);
  assert.equal((await h.service.config("admin")).hasKey, true);
  assert.ok(!JSON.stringify(await h.service.config("admin")).includes(fakeKey));
  assert.ok(!JSON.stringify(h.db()).includes(fakeKey));
});
