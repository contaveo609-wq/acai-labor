/**
 * Imports the public catalog exposed by the Açaí Labor Brendi page.
 * It keeps the existing local orders, coupons, audit trail and admin password.
 * Run: node scripts/import-brendi-catalog.mjs --write-seed --apply-local
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const sourceUrl = "https://pedido.brendi.com.br/acai-labor";
const args = new Set(process.argv.slice(2));
const slug = (value) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
const uuid = (value) => {
  const hash = createHash("sha256").update(value).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
};
const clean = (html) =>
  html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const money = (value) =>
  [...value.matchAll(/R\$\s*([\d.]+,\d{2})/g)].map((match) =>
    Number(match[1].replace(/\./g, "").replace(",", ".")),
  );
const attribute = (tag, name) => tag.match(new RegExp(`\\b${name}="([^"]*)"`, "i"))?.[1] || "";
const unitFor = (name) => {
  const value = slug(name);
  if (value.includes("combo")) return "combo";
  if (value.includes("pacote")) return "pacote";
  if (value.includes("caixa")) return "caixa";
  if (value.includes("fardo")) return "fardo";
  if (/(^|-)\d+(?:-)?l(itros?)?($|-)/.test(value) || value.includes("litro")) return "litro";
  return "unidade";
};

const response = await fetch(sourceUrl, { headers: { "user-agent": "Açai-Labor-local-import/1.0" } });
if (!response.ok) throw new Error(`Não foi possível ler o catálogo público (${response.status}).`);
const html = await response.text();
const sections = [...html.matchAll(/<section\b(?=[^>]*\bdata-category="([^"]+)")[\s\S]*?<\/section>/gi)];
if (!sections.length) throw new Error("Nenhuma categoria foi encontrada na página pública.");

const categories = [];
const products = new Map();
let cardCount = 0;
for (const [categoryIndex, section] of sections.entries()) {
  const categoryName = clean(section[1]);
  const category = {
    id: uuid(`brendi-category:${categoryName}`),
    name: categoryName,
    slug: slug(categoryName),
    emoji: null,
    sort_order: categoryIndex,
    is_active: true,
  };
  categories.push(category);
  const starts = [...section[0].matchAll(/<div\b(?=[^>]*\bdata-cy="product-card-[^"]+")[^>]*>/gi)];
  for (const [index, start] of starts.entries()) {
    const from = start.index;
    const to = starts[index + 1]?.index ?? section[0].length;
    const card = section[0].slice(from, to);
    const title = clean(card.match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/i)?.[1] || "");
    const description = clean(
      card.match(/<p\b[^>]*class="[^"]*ellipsis-3-lines[^"]*"[^>]*>([\s\S]*?)<\/p>/i)?.[1] || "",
    );
    const prices = money(clean(card));
    if (!title || !prices.length) continue;
    cardCount++;
    const key = slug(title);
    const imageTag = (card.match(/<img\b[^>]*>/gi) || []).find((tag) => {
      const src = attribute(tag, "src");
      return src.startsWith("https://images.brendi.com.br/") && attribute(tag, "alt");
    });
    const imageUrl = imageTag ? attribute(imageTag, "src") : "";
    const existing = products.get(key);
    if (existing) {
      if (!existing.source_categories.includes(categoryName)) existing.source_categories.push(categoryName);
      if (!existing.description && description) existing.description = description;
      if (!existing.product_images.length && imageUrl)
        existing.product_images.push({ id: uuid(`brendi-image:${imageUrl}`), url: imageUrl, sort_order: 0, is_primary: true });
      continue;
    }
    const base = prices[0];
    const promotional = prices.length > 1 ? prices.at(-1) : null;
    products.set(key, {
      id: uuid(`brendi-product:${key}`),
      category_id: category.id,
      name: title,
      slug: key,
      description: description || null,
      price: base,
      price_from: /a partir de/i.test(clean(card)),
      weight: null,
      quantity_label: null,
      serves: null,
      sale_unit: unitFor(title),
      min_quantity: 1,
      quantity_step: 1,
      sku: "",
      sale_options: [],
      is_active: true,
      is_sold_out: false,
      is_featured: /PROMO|MAIS PEDIDOS/i.test(categoryName),
      featured_order: products.size,
      sort_order: products.size,
      product_images: imageUrl
        ? [{ id: uuid(`brendi-image:${imageUrl}`), url: imageUrl, sort_order: 0, is_primary: true }]
        : [],
      addon_groups: [],
      promotions: promotional
        ? [{ id: uuid(`brendi-promo:${key}`), title: "Preço do catálogo público", promo_price: promotional, discount_percent: null, starts_at: null, ends_at: null, is_active: true }]
        : [],
      source_categories: [categoryName],
    });
  }
}
const store = {
  store_name: "Açaí Labor",
  tagline: "Mais sabor no seu dia.",
  description: "Açaí, cupuaçu, sorvetes, pizzas e muito mais para o seu pedido.",
  logo_url: null,
  banner_url: null,
  address_line: "Vila Nova Galvão, São Paulo",
  delivery_time_min: 21,
  delivery_time_max: 55,
  delivery_fee: 5,
  whatsapp: "",
  phone: "",
  opening_hours: "Horários a confirmar",
  is_open: true,
  primary_color: "#633185",
  accent_color: "#b4cb7c",
  hero_title: "Seu dia pede um pouco de açaí.",
  hero_description: "Cremoso na medida. Sabor em cada colherada.",
  minimum_order: 25,
  delivery_enabled: true,
  pickup_enabled: true,
  scheduling_enabled: false,
  schedule_lead_minutes: 60,
  schedule_days: 7,
  enforce_hours: false,
  weekly_hours: Array.from({ length: 7 }, (_, day) => ({ day, enabled: true, opens: "09:00", closes: "18:00" })),
};
const imported = { schema_version: 2, store, categories, products: [...products.values()], coupons: [], orders: [], audit: [] };
if (!products.size) throw new Error("Nenhum produto foi identificado no catálogo público.");

if (args.has("--write-seed"))
  await writeFile("src/data/labor-catalog.json", `${JSON.stringify(imported, null, 2)}\n`);
if (args.has("--apply-local")) {
  const localPath = resolve(process.env.DEMO_DATA_DIR || ".local/labor", "data.json");
  const current = JSON.parse(await readFile(localPath, "utf8"));
  const merged = {
    ...current,
    schema_version: 2,
    store,
    categories,
    products: imported.products,
    audit: [
      ...(current.audit || []),
      {
        id: uuid(`brendi-import:${Date.now()}`),
        at: new Date().toISOString(),
        actor: "proprietario-local",
        action: "importacao_catalogo_publico",
        resource_id: "acai-labor",
        detail: `${products.size} produtos únicos importados de ${sourceUrl}`,
      },
    ],
  };
  await mkdir(dirname(localPath), { recursive: true });
  const temporary = `${localPath}.brendi-import.tmp`;
  await writeFile(temporary, `${JSON.stringify(merged, null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, localPath);
}
console.log(`Importados ${products.size} produtos únicos de ${categories.length} categorias (${cardCount} cartões públicos lidos).`);
