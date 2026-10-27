import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { createLaborService } from "../src/lib/labor.service";
import { createPushService } from "../src/lib/push.service";
import { assertLaborRequest } from "../src/lib/labor.runtime";
import seed from "./fixtures/labor-catalog-v1.json";

test("Vercel não confirma pedidos no adaptador de arquivos temporários", async () => {
  const directory = await mkdtemp(join(tmpdir(), "labor-vercel-guard-"));
  const previous = process.env["VERCEL"];
  process.env["VERCEL"] = "1";
  try {
    const service = createLaborService(directory, seed);
    const catalog = await service.catalog();
    assert.equal(catalog.products.length, seed.products.length);
    assert.equal(catalog.ordering_enabled, false);
    const product = seed.products.find((p) => p.slug === "acai-no-copo-500ml")!;
    await assert.rejects(
      service.place(
        {
          customer_name: "Cliente",
          customer_phone: "11999990000",
          fulfillment: "pickup",
          payment_method: "pix",
          request_id: "e87fa246-d29c-4a4b-a685-8ed05850ab4a",
          items: [{ product_id: product.id, quantity: 1, addons: [] }],
        },
        "visitante",
      ),
      /armazenamento persistente ainda não configurado/,
    );
  } finally {
    if (previous === undefined) delete process.env["VERCEL"];
    else process.env["VERCEL"] = previous;
    await rm(directory, { recursive: true, force: true });
  }
});

test("dados existentes migram para cofre e continuam disponíveis após reinício", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "labor-encrypted-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(join(directory, "data.json"), JSON.stringify(seed));
  const previous = process.env["LABOR_ENCRYPT_DATA"];
  const previousKey = process.env["LABOR_SECRET_KEY"];
  process.env["LABOR_ENCRYPT_DATA"] = "1";
  process.env["LABOR_SECRET_KEY"] = randomBytes(32).toString("base64");
  try {
    const service = createLaborService(directory, seed);
    assert.equal((await service.catalog()).products.length, seed.products.length);
    await assert.rejects(readFile(join(directory, "data.json")), { code: "ENOENT" });
    const token = await service.login("Encrypted-data#2026", true);
    const original = await service.snapshot(token);
    const ciphertext = await readFile(join(directory, "database-secret.json"), "utf8");
    assert.ok(!ciphertext.includes(original.products[0]!.name));
    const restarted = createLaborService(directory, seed);
    const newToken = await restarted.login("Encrypted-data#2026", false);
    assert.equal((await restarted.snapshot(newToken)).products.length, original.products.length);
  } finally {
    if (previous === undefined) delete process.env["LABOR_ENCRYPT_DATA"];
    else process.env["LABOR_ENCRYPT_DATA"] = previous;
    if (previousKey === undefined) delete process.env["LABOR_SECRET_KEY"];
    else process.env["LABOR_SECRET_KEY"] = previousKey;
  }
});

test("inscrição push fica cifrada e só aceita endpoint HTTPS", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "labor-push-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const push = createPushService(directory);
  const subscription = {
    endpoint: "https://push.example.org/subscription/123",
    keys: { p256dh: "A".repeat(87), auth: "B".repeat(22) },
  };
  await assert.rejects(
    push.subscribe({ ...subscription, endpoint: "http://localhost/evil" }),
    /inválida/,
  );
  assert.equal((await push.subscribe(subscription)).count, 1);
  assert.equal((await push.subscribe(subscription)).count, 1);
  assert.equal((await push.status()).count, 1);
  assert.ok(
    !(await readFile(join(directory, "push-devices-secret.json"), "utf8")).includes(
      subscription.endpoint,
    ),
  );
  assert.equal((await push.unsubscribe(subscription.endpoint)).count, 0);
});

test("publicação rejeita HTTP e domínio errado", () => {
  const before = process.env["LABOR_PUBLIC_BASE_URL"];
  const encrypted = process.env["LABOR_ENCRYPT_DATA"];
  process.env["LABOR_PUBLIC_BASE_URL"] = "https://acai.example.org";
  process.env["LABOR_ENCRYPT_DATA"] = "1";
  try {
    assert.throws(() => assertLaborRequest(new Request("http://acai.example.org/admin")), /HTTPS/);
    assert.throws(
      () => assertLaborRequest(new Request("https://wrong.example.org/admin")),
      /HTTPS/,
    );
    assert.doesNotThrow(() => assertLaborRequest(new Request("https://acai.example.org/admin")));
  } finally {
    if (before === undefined) delete process.env["LABOR_PUBLIC_BASE_URL"];
    else process.env["LABOR_PUBLIC_BASE_URL"] = before;
    if (encrypted === undefined) delete process.env["LABOR_ENCRYPT_DATA"];
    else process.env["LABOR_ENCRYPT_DATA"] = encrypted;
  }
});

test("pedido reserva estoque sem duplicar e cancelamento devolve quantidade", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "labor-stock-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const service = createLaborService(directory, seed);
  const token = await service.login("Inventory-test#2026", true);
  const cup = seed.products.find((item) => item.slug === "acai-no-copo-500ml")!;
  await assert.rejects(
    service.saveStock(undefined, { productId: cup.id, saleOptionId: null, quantity: 2, lowAt: 1 }),
    /não autorizado/,
  );
  await service.saveStock(token, { productId: cup.id, saleOptionId: null, quantity: 2, lowAt: 1 });
  const requestId = crypto.randomUUID();
  const input = {
    customer_name: "Cliente Estoque",
    customer_phone: "11999990000",
    fulfillment: "pickup",
    street: "",
    number: "",
    neighborhood: "",
    payment_method: "pix",
    request_id: requestId,
    items: [{ product_id: cup.id, quantity: 1, addons: [] }],
  };
  const order = await service.place(input, "owner-stock");
  await service.place(input, "owner-stock");
  assert.equal((await service.snapshot(token)).inventory?.[0]?.quantity, 1);
  await assert.rejects(
    service.place(
      {
        ...input,
        request_id: crypto.randomUUID(),
        items: [{ product_id: cup.id, quantity: 2, addons: [] }],
      },
      "owner-stock",
    ),
    /Estoque insuficiente/,
  );
  await service.status(token, order.id, "cancelado", "Cliente desistiu");
  assert.equal((await service.snapshot(token)).inventory?.[0]?.quantity, 2);
  await service.saveStock(token, { productId: cup.id, saleOptionId: null, quantity: 0, lowAt: 1 });
  assert.equal(
    (await service.catalog()).products.find((item) => item.id === cup.id)?.is_sold_out,
    true,
  );
});

test("expedição só atribui pedido de entrega e registra conclusão", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "labor-drivers-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const service = createLaborService(directory, seed);
  const token = await service.login("Drivers-test#2026", true);
  const cup = seed.products.find((item) => item.slug === "acai-no-copo-500ml")!;
  const driver = {
    id: crypto.randomUUID(),
    name: "Entregador QA",
    phone: "11999998888",
    active: true,
    feePerDelivery: 7,
    dailyFee: 20,
  };
  await service.saveDriver(token, driver);
  const input = {
    customer_name: "Cliente QA",
    customer_phone: "11999990000",
    fulfillment: "delivery",
    street: "Rua das Flores",
    number: "12",
    neighborhood: "Centro",
    payment_method: "pix",
    request_id: crypto.randomUUID(),
    items: [{ product_id: cup.id, quantity: 1, addons: [] }],
  };
  const order = await service.place(input, "owner-delivery");
  await assert.rejects(
    service.assignDriver(token, { orderId: order.id, driverId: driver.id }),
    /pronto/,
  );
  await service.status(token, order.id, "em_preparacao");
  await service.status(token, order.id, "pronto");
  await service.assignDriver(token, { orderId: order.id, driverId: driver.id });
  await service.status(token, order.id, "saiu_entrega");
  await service.status(token, order.id, "entregue");
  const assignment = (await service.snapshot(token)).driverAssignments?.[0];
  assert.equal(assignment?.feePerDelivery, 7);
  assert.ok(assignment?.deliveredAt);
  await assert.rejects(
    service.assignDriver(token, { orderId: order.id, driverId: driver.id }),
    /pronto/,
  );
});
