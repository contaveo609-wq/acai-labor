// Measures only the local file adapter. This is not a Vercel or Supabase load test.
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createLaborService } from "../src/lib/labor.service.ts";

const count = Number(process.argv[2] || 100);
if (!Number.isInteger(count) || count < 1 || count > 1000)
  throw new Error("Choose 1 to 1000 orders.");

const fixture = JSON.parse(
  await readFile(new URL("../tests/fixtures/labor-catalog-v1.json", import.meta.url), "utf8"),
);
const product = fixture.products.find((p) => p.slug === "acai-no-copo-500ml");
if (!product) throw new Error("Benchmark product unavailable.");

const directory = await mkdtemp(join(tmpdir(), "labor-benchmark-"));
try {
  const service = createLaborService(directory, fixture);
  const started = performance.now();
  const orders = await Promise.all(
    Array.from({ length: count }, (_, index) =>
      service.place(
        {
          customer_name: `Cliente ${index}`,
          customer_phone: "11999990000",
          fulfillment: "pickup",
          street: "",
          number: "",
          neighborhood: "",
          payment_method: "pix",
          request_id: randomUUID(),
          items: [{ product_id: product.id, quantity: 1, addons: [] }],
        },
        `benchmark-customer-${index}`,
      ),
    ),
  );
  const elapsedMs = Math.round(performance.now() - started);
  const db = JSON.parse(await readFile(join(directory, "data.json"), "utf8"));
  const bytes = (await stat(join(directory, "data.json"))).size;
  if (orders.length !== count || db.orders.length !== count)
    throw new Error(`Lost orders: ${orders.length} returned, ${db.orders.length} stored.`);
  if (new Set(orders.map((order) => order.id)).size !== count)
    throw new Error("Duplicate order IDs.");
  console.log(
    JSON.stringify({
      count,
      elapsedMs,
      ordersPerSecond: +(count / (elapsedMs / 1000)).toFixed(2),
      fileBytes: bytes,
    }),
  );
} finally {
  await rm(directory, { recursive: true, force: true });
}
