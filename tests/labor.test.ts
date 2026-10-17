import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { createLaborService } from "../src/lib/labor.service";
import type { LaborOrderInput } from "../src/lib/labor.schema";
import testCatalog from "./fixtures/labor-catalog-v1.json";

const workspace = resolve(tmpdir());
const directory = await mkdtemp(resolve(workspace, "labor-tests-"));
const service = createLaborService(directory, testCatalog);
const password = "Teste-isolado#2026";
const token = await service.login(password, true);
const initial = await service.snapshot(token);
const cup = initial.products.find((p) => p.slug === "acai-no-copo-500ml")!;
const other = initial.products.find((p) => p.slug === "acai-no-copo-300ml")!;
const picole = initial.products.find((p) => p.slug.includes("picole"))!;
const input = (patch: Partial<LaborOrderInput> = {}): LaborOrderInput => ({
  customer_name: "Cliente de teste",
  customer_phone: "11999990000",
  fulfillment: "pickup",
  street: "",
  number: "",
  neighborhood: "",
  payment_method: "pix",
  request_id: randomUUID(),
  items: [{ product_id: cup.id, quantity: 2, addons: [] }],
  ...patch,
});
after(async () => {
  assert.equal(dirname(directory), workspace);
  await rm(directory, { recursive: true, force: true });
});

test("importação tem 12 produtos únicos e preços do ZIP", () => {
  assert.equal(initial.products.length, 12);
  assert.equal(new Set(initial.products.map((p) => p.slug)).size, 12);
  assert.equal(cup.price, 12);
  assert.equal(cup.promotions[0]!.promo_price, 9.99);
  assert.equal(picole.addon_groups[0]!.product_addons.length, 19);
});
test("admin não confia em tokens inventados", async () => {
  await assert.rejects(service.snapshot(), /não autorizado/);
  await assert.rejects(service.saveProduct("admin-master-001", cup), /não autorizado/);
});
test("senha validada no servidor e armazenada com hash", async () => {
  await assert.rejects(service.login("senha-incorreta-123", false), /incorreta/);
  await assert.rejects(service.login(password, true), /já está configurado/);
  const raw = await readFile(resolve(directory, "admin.json"), "utf8");
  assert.ok(!raw.includes(password));
  assert.equal((await service.session(token)).authenticated, true);
});
test("valores enviados pelo cliente não definem total; desconto e centavos são exatos", async () => {
  const order = await service.place(
    {
      ...input({
        fulfillment: "delivery",
        street: "Rua de Teste",
        number: "10",
        neighborhood: "Centro",
        coupon: "LABOR10",
      }),
      total: 0,
      unitPrice: 0.01,
    },
    "cliente-a",
  );
  assert.equal(order.total, 22.98);
  const saved = await service.order(order.id, "cliente-a");
  assert.equal(saved!.subtotal, 19.98);
  assert.equal(saved!.discount, 2);
  assert.equal(saved!.delivery_fee, 5);
});
test("pedido repetido com mesma chave é idempotente", async () => {
  const payload = input();
  const [a, b] = await Promise.all([
    service.place(payload, "cliente-b"),
    service.place(payload, "cliente-b"),
  ]);
  assert.equal(a.id, b.id);
});
test("cliente não lê o pedido de outro visitante", async () => {
  const o = await service.place(input(), "cliente-c");
  assert.equal(await service.order(o.id, "cliente-d"), null);
  assert.equal(await service.order(o.id, undefined), null);
  assert.ok(await service.order(o.id, "cliente-c"));
});
test("valida opções obrigatórias, máximo e duplicidade", async () => {
  await assert.rejects(
    service.place(input({ items: [{ product_id: picole.id, quantity: 1, addons: [] }] }), "x"),
    /mínimo/,
  );
  const a = picole.addon_groups[0]!.product_addons[0]!;
  await assert.rejects(
    service.place(
      input({
        items: [{ product_id: picole.id, quantity: 1, addons: [{ addon_id: a.id, quantity: 2 }] }],
      }),
      "x",
    ),
    /máximo/,
  );
  await assert.rejects(
    service.place(
      input({
        items: [
          {
            product_id: picole.id,
            quantity: 1,
            addons: [
              { addon_id: a.id, quantity: 1 },
              { addon_id: a.id, quantity: 1 },
            ],
          },
        ],
      }),
      "x",
    ),
    /duplicado/,
  );
});
test("adicional de outro produto é rejeitado", async () => {
  const a = other.addon_groups[0]!.product_addons[0]!;
  await assert.rejects(
    service.place(
      input({
        items: [{ product_id: cup.id, quantity: 1, addons: [{ addon_id: a.id, quantity: 1 }] }],
      }),
      "x",
    ),
    /não pertence/,
  );
});
test("pedido com sabor obrigatório é aceito e persiste a escolha", async () => {
  const a = picole.addon_groups[0]!.product_addons[0]!;
  const o = await service.place(
    input({
      items: [{ product_id: picole.id, quantity: 1, addons: [{ addon_id: a.id, quantity: 1 }] }],
    }),
    "picole",
  );
  assert.equal(
    (await service.order(o.id, "picole"))!.order_items[0]!.order_item_addons[0]!.name,
    a.name,
  );
});
test("produtos esgotados são bloqueados também no servidor", async () => {
  await service.saveProduct(token, { ...cup, is_sold_out: true });
  await assert.rejects(service.place(input(), "x"), /indisponível/);
  await service.saveProduct(token, cup);
});
test("adicional pago usa o preço do servidor", async () => {
  const edited = structuredClone(cup);
  edited.addon_groups[0]!.product_addons[0]!.price = 2.5;
  await service.saveProduct(token, edited);
  const o = await service.place(
    input({
      items: [
        {
          product_id: cup.id,
          quantity: 2,
          addons: [{ addon_id: edited.addon_groups[0]!.product_addons[0]!.id, quantity: 1 }],
        },
      ],
    }),
    "paid",
  );
  assert.equal(o.total, 24.98);
  await service.saveProduct(token, cup);
});
test("loja fechada e categoria desativada impedem pedidos", async () => {
  await service.saveStore(token, { ...initial.store, is_open: false });
  await assert.rejects(service.place(input(), "x"), /fechada/);
  await service.saveStore(token, initial.store);
  const category = initial.categories.find((c) => c.id === cup.category_id)!;
  await service.saveCategory(token, { ...category, is_active: false });
  await assert.rejects(service.place(input(), "x"), /Categoria/);
  await service.saveCategory(token, category);
});
test("checkout valida telefone, endereço, quantidade, cupom e troco", async () => {
  await assert.rejects(service.place(input({ customer_phone: "123" }), "x"));
  await assert.rejects(service.place(input({ fulfillment: "delivery" }), "x"));
  await assert.rejects(service.place(input({ coupon: "INVALIDO" }), "x"), /Cupom inválido/);
  await assert.rejects(
    service.place(input({ payment_method: "dinheiro", change_for: 1 }), "x"),
    /troco/,
  );
  await assert.rejects(
    service.place(input({ items: [{ product_id: cup.id, quantity: -1, addons: [] }] }), "x"),
  );
});
test("total mudou após o resumo: exige nova revisão", async () => {
  await assert.rejects(
    service.place(input({ expected_total: 1 }), "x"),
    /preços foram atualizados/,
  );
});
test("admin muda status; retirada não pode sair para entrega", async () => {
  const o = await service.place(input(), "status");
  await assert.rejects(service.status(undefined, o.id, "pronto"), /não autorizado/);
  await service.status(token, o.id, "em_preparacao");
  assert.equal((await service.order(o.id, "status"))!.status, "em_preparacao");
  await assert.rejects(service.status(token, o.id, "saiu_entrega"), /retirada/);
  await service.status(token, o.id, "pronto");
  await service.status(token, o.id, "concluido");
  await assert.rejects(service.status(token, o.id, "recebido"), /encerrado/);
});
test("dados permanecem após reiniciar o serviço; sessões exigem novo login", async () => {
  const restarted = createLaborService(directory);
  assert.equal((await restarted.session(token)).authenticated, false);
  const newToken = await restarted.login(password, false);
  const data = await restarted.snapshot(newToken);
  assert.ok(data.orders.length >= 5);
  assert.equal(data.products.length, 12);
  restarted.logout(newToken);
  assert.equal((await restarted.session(newToken)).authenticated, false);
});
