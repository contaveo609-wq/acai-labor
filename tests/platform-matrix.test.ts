import { after, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import catalog from "../src/data/labor-catalog.json";
import { productSchema } from "../src/lib/labor.schema";
import { createLaborService } from "../src/lib/labor.service";

// 468 independent acceptance cases. Together with the existing 75 unit and
// 12 browser checks, this release run executes 555 scenarios.
const directory = await mkdtemp(join(tmpdir(), "labor-platform-matrix-"));
const service = createLaborService(directory, catalog);
const menu = await service.catalog();
const products = catalog.products;
const visible = new Map(menu.products.map((product) => [product.id, product]));
const categories = new Set(menu.categories.map((category) => category.id));

after(() => rm(directory, { recursive: true, force: true }));

function itemFor(product: (typeof products)[number], fulfillment: "pickup" | "delivery") {
  const addons = product.addon_groups.flatMap((group) => {
    const required = group.is_required ? Math.max(1, group.min_select) : group.min_select;
    return group.product_addons
      .filter((addon) => addon.is_active)
      .slice(0, required)
      .map((addon) => ({ addon_id: addon.id, quantity: 1, price: addon.price }));
  });
  const now = Date.now();
  const promotion = product.promotions.find((item) =>
    item.is_active && (!item.starts_at || Date.parse(item.starts_at) <= now) && (!item.ends_at || Date.parse(item.ends_at) >= now));
  const basePrice = promotion?.promo_price ?? (promotion?.discount_percent != null
    ? product.price * (1 - promotion.discount_percent / 100)
    : product.price);
  const unitPrice = basePrice + addons.reduce((total, addon) => total + addon.price, 0);
  const minimum = product.min_quantity || 1;
  const step = product.quantity_step || 1;
  // The catalog enforces a R$25 product minimum for both pickup and delivery.
  const wanted = Math.max(minimum, 25 / unitPrice);
  const quantity = Math.round((minimum + Math.ceil(Math.max(0, wanted - minimum) / step) * step) * 1000) / 1000;
  return {
    product_id: product.id,
    quantity,
    addons: addons.map(({ addon_id, quantity }) => ({ addon_id, quantity })),
  };
}

function quote(product: (typeof products)[number], fulfillment: "pickup" | "delivery") {
  return service.place(
    {
      customer_name: "Matriz de qualidade",
      customer_phone: "11999990000",
      fulfillment,
      street: fulfillment === "delivery" ? "Rua de testes" : "",
      number: fulfillment === "delivery" ? "555" : "",
      neighborhood: fulfillment === "delivery" ? "Centro" : "",
      payment_method: "pix",
      request_id: randomUUID(),
      items: [itemFor(product, fulfillment)],
    },
    `matrix-${fulfillment}-${product.id}`,
    { quote: true },
  );
}

for (const product of products) {
  test(`matriz catálogo: esquema válido — ${product.slug}`, () => {
    assert.equal(productSchema.safeParse(product).success, true);
  });
}

for (const product of products) {
  test(`matriz catálogo: produto público e categoria ativa — ${product.slug}`, () => {
    const publicProduct = visible.get(product.id);
    assert.ok(publicProduct);
    assert.equal(publicProduct.name, product.name);
    assert.ok(categories.has(product.category_id!));
  });
}

for (const product of products) {
  test(`matriz checkout: cotação para retirada — ${product.slug}`, async () => {
    const result = await quote(product, "pickup");
    assert.equal(result.id, "");
    assert.ok(Number.isFinite(result.total) && result.total > 0);
    assert.match(result.summary, new RegExp(product.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  });
}

for (const product of products.slice(0, 102)) {
  test(`matriz checkout: cotação para entrega — ${product.slug}`, async () => {
    const delivery = await quote(product, "delivery");
    assert.ok(delivery.total >= 25);
    assert.match(delivery.summary, /Rua de testes, 555 — Centro/);
  });
}
