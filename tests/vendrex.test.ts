import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { createLaborService } from "../src/lib/labor.service";
import {
  DEFAULT_HOURS,
  operatingAt,
  dashboardTotals,
  validateFulfillment,
} from "../src/lib/vendrex.rules";
import { productSchema, storeSchema } from "../src/lib/labor.schema";
import seed from "./fixtures/labor-catalog-v1.json";
const directory = await mkdtemp(resolve(tmpdir(), "vendrex-unit-"));
const service = createLaborService(directory, seed);
const password = "Senha-local-testes#2026";
const token = await service.login(password, true);
const initial = await service.snapshot(token);
const product = initial.products.find((p) => p.slug === "acai-no-copo-500ml")!;
const input = (patch: Record<string, unknown> = {}) => ({
  customer_name: "Teste V2",
  customer_phone: "11999990000",
  fulfillment: "pickup",
  payment_method: "pix",
  request_id: randomUUID(),
  items: [{ product_id: product.id, quantity: 2, addons: [] }],
  ...patch,
});
after(async () => {
  assert.equal(dirname(directory), resolve(tmpdir()));
  await rm(directory, { recursive: true, force: true });
});

test("migração aditiva preserva produtos, pedidos e senha da V1", async () => {
  const oldOrder = { id: randomUUID(), status: "entregue", total: 33 };
  const dir = resolve(directory, "v1");
  const { mkdir } = await import("node:fs/promises");
  await mkdir(dir);
  await writeFile(resolve(dir, "data.json"), JSON.stringify({ ...seed, orders: [oldOrder] }));
  const v1 = createLaborService(dir);
  const auth = await v1.login(password, true);
  const db = await v1.snapshot(auth);
  assert.equal(db.products.length, seed.products.length);
  assert.equal(db.orders[0]!.id, oldOrder.id);
  assert.equal(db.orders[0]!.total, 33);
  assert.equal(db.orders[0]!.payment_status, "pendente");
  assert.equal(db.schema_version, 2);
  assert.equal(db.store.store_name, "Açaí Labor");
  assert.ok(!JSON.stringify(db).includes(password));
});
test("embalagem tem preço próprio, mínimo e múltiplos no servidor", async () => {
  const id = randomUUID();
  await service.saveProduct(token, {
    ...product,
    sale_options: [
      {
        id,
        label: "Fardo de teste",
        unit: "fardo",
        price: 51.25,
        min_quantity: 2,
        quantity_step: 2,
        is_active: true,
      },
    ],
  });
  const item = { product_id: product.id, sale_option_id: id, quantity: 4, addons: [] };
  const result = await service.place(input({ items: [item], price: 0.01 }), "pack");
  assert.equal(result.total, 205);
  const order = await service.order(result.id, "pack");
  assert.equal(order?.order_items[0]?.sale_label, "Fardo de teste");
  for (const quantity of [1, 3, 0.5])
    await assert.rejects(
      service.place(input({ items: [{ ...item, quantity }] }), "pack"),
      /Quantidade/,
    );
  await assert.rejects(
    service.place(input({ items: [{ ...item, sale_option_id: randomUUID() }] }), "pack"),
    /Embalagem/,
  );
  await service.saveProduct(token, product);
});
test("kg fracionado arredonda cada linha em centavos", async () => {
  await service.saveProduct(token, {
    ...product,
    sale_unit: "kg",
    min_quantity: 0.25,
    quantity_step: 0.25,
    price: 9.99,
    promotions: [],
  });
  const o = await service.place(
    input({ items: [{ product_id: product.id, quantity: 0.25, addons: [] }] }),
    "weight",
  );
  assert.equal(o.total, 2.5);
  await assert.rejects(
    service.place(
      input({ items: [{ product_id: product.id, quantity: 0.3, addons: [] }] }),
      "weight",
    ),
    /Quantidade/,
  );
  await service.saveProduct(token, product);
});
test("mínimo considera desconto e exclui frete", async () => {
  await service.saveStore(token, { ...initial.store, minimum_order: 20 });
  await assert.rejects(
    service.place(
      input({ fulfillment: "delivery", street: "Teste", number: "1", neighborhood: "Teste" }),
      "min",
    ),
    /mínimo/,
  );
  await service.saveStore(token, { ...initial.store, minimum_order: 19 });
  await assert.rejects(service.place(input({ coupon: "LABOR10" }), "min"), /mínimo/);
  await service.saveStore(token, initial.store);
});
test("horários em Brasília, inclusive virada de dia, e limites de agendamento", () => {
  const store = {
    ...initial.store,
    enforce_hours: true,
    weekly_hours: DEFAULT_HOURS.map((h) => ({
      ...h,
      enabled: h.day === 1,
      opens: "22:00",
      closes: "02:00",
    })),
  };
  assert.equal(operatingAt(store, new Date("2026-10-19T22:00:00-03:00")), true);
  assert.equal(operatingAt(store, new Date("2026-10-20T01:59:00-03:00")), true);
  assert.equal(operatingAt(store, new Date("2026-10-20T02:00:00-03:00")), false);
  assert.equal(operatingAt(store, new Date("2026-10-19T21:59:00-03:00")), false);
  assert.throws(
    () =>
      validateFulfillment(
        { ...store, scheduling_enabled: true },
        "pickup",
        "2026-10-19T22:10:00-03:00",
        new Date("2026-10-19T22:00:00-03:00"),
      ),
    /prazo/,
  );
});
test("agendamento e modalidades desativadas são conferidos no servidor", async () => {
  const date = new Date(Date.now() + 2 * 3600000).toISOString();
  await assert.rejects(service.place(input({ scheduled_for: date }), "schedule"), /Agendamento/);
  await service.saveStore(token, { ...initial.store, scheduling_enabled: true });
  const o = await service.place(input({ scheduled_for: date }), "schedule");
  assert.equal((await service.order(o.id, "schedule"))!.scheduled_for, date);
  await service.saveStore(token, { ...initial.store, pickup_enabled: false });
  await assert.rejects(service.place(input(), "schedule"), /desativada/);
  await service.saveStore(token, initial.store);
});
test("idempotência resiste à concorrência e rejeita conteúdo diferente", async () => {
  const payload = input();
  const results = await Promise.all(
    Array.from({ length: 12 }, () => service.place(payload, "same")),
  );
  assert.equal(new Set(results.map((r) => r.id)).size, 1);
  await assert.rejects(
    service.place({ ...payload, customer_name: "Alterado" }, "same"),
    /outro conteúdo/,
  );
  const result = await service.place(payload, "another");
  assert.notEqual(result.id, results[0]!.id);
});
test("concluir entrega não confirma pagamento; status arbitrário é negado", async () => {
  const o = await service.place(input({ payment_status: "pago" }), "flow");
  await assert.rejects(service.status(token, o.id, "concluido"), /Transição/);
  await service.status(token, o.id, "em_preparacao", "", "recebido");
  await assert.rejects(service.status(token, o.id, "pronto", "", "recebido"), /outro atendimento/);
  await service.status(token, o.id, "pronto");
  await service.status(token, o.id, "concluido");
  const order = (await service.order(o.id, "flow"))!;
  assert.equal(order.payment_status, "pendente");
  assert.equal(dashboardTotals([order]).paid, 0);
  await assert.rejects(service.status(token, o.id, "recebido"), /encerrado/);
});
test("cancelamento exige motivo e notas internas não aparecem ao cliente", async () => {
  const o = await service.place(input(), "notes");
  await assert.rejects(service.addNote(undefined, o.id, "interna"), /não autorizado/);
  await service.addNote(token, o.id, "Nota privada de teste");
  await assert.rejects(service.status(token, o.id, "cancelado"), /motivo/);
  await service.status(token, o.id, "cancelado", "Solicitado pelo cliente");
  const publicOrder = await service.order(o.id, "notes");
  assert.ok(!JSON.stringify(publicOrder).includes("Nota privada"));
  assert.ok(!JSON.stringify(publicOrder).includes("request_id"));
  assert.equal(publicOrder?.history.at(-1)?.reason, "Solicitado pelo cliente");
  const db = await service.snapshot(token);
  assert.ok(db.audit?.some((a) => a.action === "pedido.nota"));
});
test("cadastros rejeitam vínculo incorreto, IDs duplicados e unidades inválidas", () => {
  const p = structuredClone(product);
  p.addon_groups[0]!.product_addons[0]!.group_id = randomUUID();
  assert.throws(() => productSchema.parse(p), /grupo errado/);
  assert.throws(() => productSchema.parse({ ...product, min_quantity: 0.5 }), /fracionadas/);
  assert.throws(() =>
    storeSchema.parse({ ...initial.store, delivery_enabled: false, pickup_enabled: false }),
  );
  assert.throws(() =>
    storeSchema.parse({ ...initial.store, primary_color: "url(javascript:alert(1))" }),
  );
  assert.throws(() =>
    productSchema.parse({
      ...product,
      product_images: [
        { id: randomUUID(), url: "javascript:alert(1)", sort_order: 0, is_primary: true },
      ],
    }),
  );
});
test("limite de tentativas funciona também em requisições paralelas", async () => {
  const replies = await Promise.allSettled(
    Array.from({ length: 8 }, () => service.login("senha-incorreta-1234", false, "abuse")),
  );
  assert.equal(replies.filter((r) => r.status === "rejected").length, 8);
  assert.ok(
    replies.some((r) => r.status === "rejected" && /Muitas tentativas/.test(r.reason.message)),
  );
  await assert.rejects(service.login(password, false, "abuse"), /Muitas tentativas/);
});
test("falha de persistência não retorna compra confirmada", async () => {
  const path = resolve(directory, "broken");
  await writeFile(path, "not a directory");
  await assert.rejects(createLaborService(path).place(input(), "broken"));
});
test("dados e auditoria persistem após reinício", async () => {
  const newService = createLaborService(directory);
  assert.equal((await newService.session(token)).authenticated, false);
  const newToken = await newService.login(password, false);
  const db = await newService.snapshot(newToken);
  assert.ok(db.orders.length > 5);
  assert.ok(db.audit!.length > 5);
  assert.ok(!(await readFile(resolve(directory, "data.json"), "utf8")).includes(password));
});
