import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { createWhatsAppService, whatsappState, validSignature } from "../src/lib/whatsapp.service";
import { createWhatsAppTransport, WhatsAppError } from "../src/lib/whatsapp.transport";
import { createSupportService } from "../src/lib/support.service";
import {
  createOperationsService,
  operationsState,
  customers,
  marketingAllowed,
} from "../src/lib/operations.service";
import { base32, totp } from "../src/lib/security.service";
import type { LaborDatabase } from "../src/lib/labor.types";
import type { LaborDependencies } from "../src/lib/labor.dependencies";
import type { WhatsAppOutbound } from "../src/lib/whatsapp.types";
import seed from "../src/data/labor-catalog.json";
function harness(order?: NonNullable<Parameters<typeof createWhatsAppService>[2]>["order"]) {
  let db = structuredClone(seed) as unknown as LaborDatabase;
  let queue: Promise<unknown> = Promise.resolve();
  const deps: LaborDependencies = {
    directory: "unused-test-vault",
    storeId: "acai-labor",
    read: async () => structuredClone(db),
    mutate: (fn) => {
      const promise = queue.then(async () => {
        const copy = structuredClone(db);
        const result = await fn(copy);
        db = copy;
        return result;
      });
      queue = promise.catch(() => {});
      return promise;
    },
    requireAdmin: (t) => {
      if (t !== "admin") throw new Error("unauthorized");
    },
    requireSensitive: (t) => {
      if (t !== "admin") throw new Error("MFA");
    },
    audit: (db, action, resource_id, detail) => {
      (db.audit ??= []).push({
        id: randomUUID(),
        action,
        resource_id,
        detail,
        at: new Date().toISOString(),
        actor: "test",
      });
    },
  };
  const wa = whatsappState(db);
  wa.config = {
    ...wa.config,
    wabaId: "12345",
    phoneId: "56789",
    apiVersion: "v24.0",
    enabled: true,
    autoReply: true,
  };
  wa.lastTest = { at: new Date().toISOString(), ok: true, error: "", displayPhone: "test" };
  let secret = JSON.stringify({
    token: "test-token",
    appSecret: "test-app-secret",
    verifyToken: "verify-test-token",
    identityKey: "stable-test-identity",
  });
  const sent: WhatsAppOutbound[] = [];
  let failure: Error | undefined;
  const transport = {
    ...createWhatsAppTransport(),
    test: async () => ({ displayPhone: "test" }),
    templates: async () => [],
    send: async (_c: unknown, _s: unknown, job: WhatsAppOutbound) => {
      if (failure) throw failure;
      sent.push(job);
      return { id: `wamid.out.${sent.length}` };
    },
  };
  const support = createSupportService(deps),
    service = createWhatsAppService(deps, support, {
      ...(order ? { order } : {}),
      transport,
      secrets: {
        get: async () => secret,
        replace: async (value) => {
          secret = value;
        },
      },
    }),
    operations = createOperationsService(deps);
  const payload = (id: string, text = "cardapio", offset = 0, extra: object = {}) =>
    JSON.stringify({
      object: "whatsapp_business_account",
      entry: [
        {
          id: "12345",
          changes: [
            {
              field: "messages",
              value: {
                metadata: { phone_number_id: "56789" },
                contacts: [{ wa_id: "5581999999999", profile: { name: "Cliente teste" } }],
                messages: [
                  {
                    id,
                    from: "5581999999999",
                    timestamp: String(Math.floor(Date.now() / 1000) + offset),
                    type: "text",
                    text: { body: text },
                    ...extra,
                  },
                ],
              },
            },
          ],
        },
      ],
    });
  const receive = (raw: string) =>
    service.receive(
      raw,
      `sha256=${createHmac("sha256", "test-app-secret").update(raw).digest("hex")}`,
    );
  return {
    db: () => db,
    deps,
    service,
    support,
    operations,
    sent,
    payload,
    receive,
    fail: (e: Error | undefined) => {
      failure = e;
    },
  };
}
test("HMAC rejeita assinatura inválida, segredo ausente e conteúdo alterado", () => {
  const raw = '{"test":true}',
    signature = `sha256=${createHmac("sha256", "secret").update(raw).digest("hex")}`;
  assert.ok(validSignature(raw, signature, "secret"));
  assert.equal(validSignature(raw + " ", signature, "secret"), false);
  assert.equal(validSignature(raw, signature, ""), false);
});
test("webhook assinado, deduplicação, catálogo real e recibos fora de ordem", async () => {
  const h = harness(),
    raw = h.payload("wamid.in.1");
  assert.equal((await h.service.receive(raw, "bad")).status, 403);
  assert.equal((await h.receive(raw)).status, 200);
  await h.receive(raw);
  assert.equal(h.db().whatsapp!.inbound.length, 1);
  await h.service.runOnce();
  assert.equal(h.sent.length, 1);
  assert.match(h.sent[0]!.text, /R\$/);
  const receipt = (status: string) =>
    JSON.stringify({
      object: "whatsapp_business_account",
      entry: [
        {
          id: "12345",
          changes: [
            {
              field: "messages",
              value: {
                metadata: { phone_number_id: "56789" },
                statuses: [
                  { id: "wamid.out.1", status, timestamp: String(Math.floor(Date.now() / 1000)) },
                ],
              },
            },
          ],
        },
      ],
    });
  await h.receive(receipt("read"));
  await h.receive(receipt("sent"));
  assert.equal(h.db().whatsapp!.outbound[0]!.state, "read");
  await h.service.runOnce();
  assert.equal(h.sent.length, 1);
});
test("loja incorreta, replay antigo e evento futuro não criam mensagens", async () => {
  const h = harness();
  await h.receive(h.payload("a").replace('"12345"', '"99999"'));
  await h.receive(h.payload("b", "oi", -8 * 86400));
  await h.receive(h.payload("c", "oi", 3600));
  assert.equal(h.db().whatsapp!.inbound.length, 0);
});
test("mensagem atrasada mantém histórico e não dispara resposta antiga", async () => {
  const h = harness();
  await h.receive(h.payload("a"));
  await h.service.runOnce();
  await h.receive(h.payload("b", "oi", -100));
  await h.service.runOnce();
  assert.equal(h.sent.length, 1);
  assert.equal(
    h.db().support!.conversations[0]!.messages.filter((m) => m.role === "customer").length,
    2,
  );
});
test("atendente interrompe IA e responde pela mesma fila", async () => {
  const h = harness();
  await h.receive(h.payload("a"));
  await h.service.runOnce();
  const c = h.db().support!.conversations[0]!;
  await h.support.control("admin", c.id, "claim");
  await h.receive(h.payload("b", "oi"));
  await h.service.runOnce();
  assert.equal(h.sent.length, 1);
  const id = randomUUID();
  await h.service.reply("admin", c.id, id, "Resposta humana");
  await h.service.reply("admin", c.id, id, "Resposta humana");
  await h.service.runOnce();
  assert.equal(h.sent.length, 2);
  await assert.rejects(h.service.reply("bad", c.id, randomUUID(), "x"), /unauthorized/);
});
test("janela encerrada exige template aprovado", async () => {
  const h = harness();
  await h.receive(h.payload("a"));
  await h.service.runOnce();
  const c = h.db().support!.conversations[0]!;
  await h.support.control("admin", c.id, "claim");
  h.db().support!.conversations[0]!.lastInboundAt = new Date(
    Date.now() - 2 * 86400000,
  ).toISOString();
  await assert.rejects(h.service.reply("admin", c.id, randomUUID(), "Olá"), /24 horas/);
  await assert.rejects(
    h.service.reply("admin", c.id, randomUUID(), "Olá", {
      name: "unknown",
      language: "pt_BR",
      parameters: [],
    }),
    /template aprovado/,
  );
});
test("429 usa backoff; falha ambígua não reenvia automaticamente", async () => {
  const h = harness();
  h.fail(new WhatsAppError("429", true));
  await h.receive(h.payload("a"));
  await h.service.runOnce();
  assert.equal(h.db().whatsapp!.outbound[0]!.state, "queued");
  assert.ok(Date.parse(h.db().whatsapp!.outbound[0]!.dueAt) > Date.now());
  h.db().whatsapp!.outbound[0]!.dueAt = new Date(0).toISOString();
  h.fail(new WhatsAppError("network", false, true));
  await h.service.runOnce();
  assert.equal(h.db().whatsapp!.outbound[0]!.state, "uncertain");
  h.fail(undefined);
  await h.service.runOnce();
  assert.equal(h.sent.length, 0);
});
test("mídia não suportada encaminha para humano", async () => {
  const h = harness();
  await h.receive(h.payload("a", "", 0, { type: "sticker" }));
  await h.service.runOnce();
  assert.equal(h.db().support!.conversations[0]!.mode, "waiting");
  assert.match(h.sent[0]!.text, /mídia/);
});
test("CRM exige evidência de consentimento, saída cancela campanha", async () => {
  const h = harness();
  await h.receive(h.payload("a"));
  await h.service.runOnce();
  const contact = {
    phone: "5581999999999",
    tags: ["teste"],
    notes: "",
    consent: true,
    evidence: "",
  };
  await assert.rejects(h.operations.saveContact("admin", contact), /evidência/);
  await h.operations.saveContact("admin", {
    ...contact,
    evidence: "Formulário autorizado pelo cliente",
  });
  assert.ok(marketingAllowed(h.db(), contact.phone));
  await h.receive(h.payload("stop", "SAIR"));
  assert.equal(marketingAllowed(h.db(), contact.phone), false);
  assert.equal(customers(h.db())[0]!.tags[0], "teste");
});
test("campanha sem consentimento, template inválido e pausa", async () => {
  const h = harness();
  await h.receive(h.payload("a"));
  await h.service.runOnce();
  const id = randomUUID();
  await h.operations.saveCampaign("admin", {
    id,
    name: "Campanha",
    segment: "all",
    template: "promo",
    language: "pt_BR",
    parameters: [],
    scheduledAt: new Date().toISOString(),
  });
  assert.equal(operationsState(h.db()).campaigns[0]!.recipients.length, 0);
  await assert.rejects(h.operations.campaignAction("admin", id, "confirm"), /template/);
  await h.operations.saveContact("admin", {
    phone: "5581999999999",
    tags: [],
    notes: "",
    consent: true,
    evidence: "Cliente autorizou em formulário",
  });
  h.db().whatsapp!.templates = [
    {
      id: "1",
      name: "promo",
      language: "pt_BR",
      status: "APPROVED",
      category: "MARKETING",
      body: "Teste",
      variables: 0,
      usable: true,
    },
  ];
  h.db().whatsapp!.templatesAt = new Date().toISOString();
  await h.operations.saveCampaign("admin", {
    id,
    name: "Campanha",
    segment: "all",
    template: "promo",
    language: "pt_BR",
    parameters: [],
    scheduledAt: new Date().toISOString(),
  });
  await h.operations.campaignAction("admin", id, "confirm");
  await h.operations.tick();
  await h.operations.campaignAction("admin", id, "pause");
  await h.service.runOnce();
  assert.equal(h.sent.length, 1);
  assert.equal(h.db().whatsapp!.outbound.find((j) => j.campaignId === id)!.state, "cancelled");
});
test("TOTP segue vetores RFC 6238", () => {
  const secret = base32(Buffer.from("12345678901234567890"));
  assert.equal(totp(secret, 59000, 8), "94287082");
  assert.equal(totp(secret, 1111111109000, 8), "07081804");
});
test("proposta WhatsApp só cria pedido após confirmação do cliente e não duplica", async () => {
  const orders = new Map<
    string,
    { id: string; order_number: number; total: number; summary: string }
  >();
  const h = harness(async (raw, _owner, quote) => {
    const input = raw as { request_id: string };
    if (quote)
      return { id: "", order_number: 0, total: 20, summary: "2 produtos. Total R$ 20,00." };
    if (!orders.has(input.request_id))
      orders.set(input.request_id, {
        id: randomUUID(),
        order_number: 1001,
        total: 20,
        summary: "",
      });
    return orders.get(input.request_id)!;
  });
  await h.receive(h.payload("proposal-contact"));
  await h.service.runOnce();
  const c = h.db().support!.conversations[0]!;
  await h.support.control("admin", c.id, "claim");
  await h.service.propose("admin", c.id, {
    customer_name: "Cliente",
    customer_phone: "5581999999999",
    fulfillment: "pickup",
    payment_method: "pix",
    request_id: randomUUID(),
    items: [{ product_id: seed.products[0]!.id, quantity: 1, addons: [] }],
  });
  assert.equal(orders.size, 0);
  await h.service.runOnce();
  const draft = h.db().whatsapp!.drafts![0]!;
  await h.receive(h.payload("confirmation", `CONFIRMAR ${draft.code}`));
  await h.service.runOnce();
  assert.equal(orders.size, 1);
  assert.equal(h.db().whatsapp!.drafts![0]!.state, "confirmed");
  await h.receive(h.payload("confirmation", `CONFIRMAR ${draft.code}`));
  await h.service.runOnce();
  assert.equal(orders.size, 1);
  assert.match(h.sent.at(-1)!.text, /Pagamento pendente/);
});
test("download de mídia rejeita origem externa, tipo e tamanho; JPEG autorizado usa domínio Meta", async () => {
  const config = harness().db().whatsapp!.config,
    secrets = { token: "fake-token", appSecret: "", verifyToken: "", identityKey: "" };
  const bad = createWhatsAppTransport(async () =>
    Response.json({ mime_type: "image/jpeg", file_size: 10, url: "https://example.com/steal" }),
  );
  await assert.rejects(bad.media(config, secrets, "123456"), /Origem/);
  const big = createWhatsAppTransport(async () =>
    Response.json({
      mime_type: "image/jpeg",
      file_size: 9000000,
      url: "https://lookaside.fbsbx.com/file",
    }),
  );
  await assert.rejects(big.media(config, secrets, "123456"), /tamanho/);
  const unsupported = createWhatsAppTransport(async () =>
    Response.json({
      mime_type: "text/html",
      file_size: 10,
      url: "https://lookaside.fbsbx.com/file",
    }),
  );
  await assert.rejects(unsupported.media(config, secrets, "123456"), /Formato/);
  let call = 0;
  const jpeg = createWhatsAppTransport(async (url, init) => {
    call++;
    assert.equal(init?.redirect, "error");
    return call === 1
      ? Response.json({
          mime_type: "image/jpeg",
          file_size: 3,
          url: "https://lookaside.fbsbx.com/file",
        })
      : new Response(new Uint8Array([255, 216, 255]));
  });
  const file = await jpeg.media(config, secrets, "123456");
  assert.equal(file.mime, "image/jpeg");
  assert.equal(file.bytes.length, 3);
});
test("desafio de webhook valida token e rejeita Unicode malformado sem erro interno", async () => {
  const h = harness();
  assert.equal(
    (
      await h.service.verify(
        new URL(
          "https://example.com/api/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=verify-test-token&hub.challenge=123",
        ),
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await h.service.verify(
        new URL(
          "https://example.com/api/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=ááááááááááááááááá&hub.challenge=123",
        ),
      )
    ).status,
    403,
  );
});
test("transporte não expõe token em erros e não segue redirects", async () => {
  let headers: Headers | undefined;
  const transport = createWhatsAppTransport(async (_url, init) => {
    headers = new Headers(init?.headers);
    assert.equal(init?.redirect, "error");
    return new Response('{"error":"secret-token-value"}', { status: 401 });
  });
  const h = harness();
  await assert.rejects(
    transport.test(h.db().whatsapp!.config, {
      token: "secret-token-value",
      appSecret: "",
      verifyToken: "",
      identityKey: "",
    }),
    (e) =>
      e instanceof Error && e.message.includes("401") && !e.message.includes("secret-token-value"),
  );
  assert.equal(headers?.get("Authorization"), "Bearer secret-token-value");
});
