import { readdir, readFile, mkdir, copyFile, writeFile } from "node:fs/promises";
import { resolve, join, basename } from "node:path";
import { createHash } from "node:crypto";

const source = resolve(process.argv[2] || "../../work/materiais/açai-labor");
const slug = (s) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
const uuid = (s) => {
  const h = createHash("sha256").update(s).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
const categoryNames = [
  "No copo",
  "Açaí para compartilhar",
  "Cupuaçu",
  "Sorvetes e picolés",
  "Atacado",
];
const categories = categoryNames.map((name, i) => ({
  id: uuid(name),
  name,
  slug: slug(name),
  emoji: null,
  sort_order: i,
  is_active: true,
}));
const products = new Map();
const provenance = [];
await mkdir("public/catalog", { recursive: true });
async function scan(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      await scan(path);
      continue;
    }
    if (!entry.name.endsWith(".txt")) continue;
    const text = (await readFile(path, "utf8")).replace(/^\uFEFF/, "");
    const lines = text
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    const originalName = lines[0];
    const prices = [...text.matchAll(/R\$\s*([\d.]+,\d{2})/g)].map((m) =>
      Number(m[1].replace(/\./g, "").replace(",", ".")),
    );
    if (!prices.length) throw new Error(`Preço ausente: ${path}`);
    const n = slug(originalName);
    let key = n;
    if (/^acai-labor-(caixa-|de-)?2-?l$/.test(n)) key = "acai-labor-2l";
    const nameMap = {
      "acai-no-copo-300ml": "Açaí no copo · 300 ml",
      "acai-no-copo-500ml": "Açaí no copo · 500 ml",
      "acai-labor-caixa-1l": "Açaí Labor · 1 litro",
      "acai-labor-2l": "Açaí Labor · 2 litros",
      "acai-labor-5l": "Açaí Labor · 5 litros",
      "acai-labor-de-10-l": "Açaí Labor · 10 litros",
      "cupuacu-5-l": "Cupuaçu Labor · 5 litros",
      "cupuacu-de-10-l": "Cupuaçu Labor · 10 litros",
      "cupuacu-labor-2-litros": "Cupuaçu Labor · 2 litros",
      "10-caixas-acai-labor-10-litros": "Combo 10 caixas · 10 litros cada",
      "picole-atacado-01-pacote-com-10-unidades": "Picolés Labor · pacote com 10",
      "sorvete-labor-2-litros-frutas-vermelhas": "Sorvete de frutas vermelhas · 2 litros",
    };
    const imageFiles = (await readdir(dir)).filter((s) => /\.(webp|png|jpg|jpeg)$/i.test(s));
    const images = [];
    for (const image of imageFiles) {
      const dest = `${key}-${basename(image)}`;
      await copyFile(join(dir, image), join("public/catalog", dest));
      images.push({
        id: uuid(dest),
        url: `/catalog/${dest}`,
        sort_order: images.length,
        is_primary: images.length === 0,
      });
    }
    provenance.push({
      file: path.slice(source.length + 1),
      product: key,
      original_name: originalName,
      prices,
      images: imageFiles,
    });
    const existing = products.get(key);
    if (existing) {
      existing.is_featured ||= path.includes("Mais Pedidos");
      existing.source_categories.push(basename(resolve(dir, "..")));
      continue;
    }
    const copo = key.includes("copo");
    const picole = key.includes("picole");
    const catIndex = copo
      ? 0
      : key.startsWith("cupuacu")
        ? 2
        : key.includes("sorvete") || picole
          ? 3
          : key.startsWith("10-caixas")
            ? 4
            : 1;
    const id = uuid(key);
    const addons = [];
    if (picole)
      addons.push({
        id: uuid(key + "sabores"),
        title: "Escolha o sabor do pacote",
        min_select: 1,
        max_select: 1,
        is_required: true,
        sort_order: 0,
        product_addons: lines
          .filter((l) => /^10 PICOLÉS/.test(l))
          .map((name, i) => ({
            id: uuid(key + name),
            group_id: uuid(key + "sabores"),
            name: name.replace("10 PICOLÉS DE ", "").toLocaleLowerCase("pt-BR"),
            description: "Pacote com 10 unidades do mesmo sabor",
            price: 0,
            is_active: true,
            sort_order: i,
          })),
      });
    if (copo)
      addons.push({
        id: uuid(key + "extras"),
        title: "Complementos · demonstração",
        min_select: 0,
        max_select: 3,
        is_required: false,
        sort_order: 0,
        product_addons: ["Banana", "Granola", "Leite em pó"].map((name, i) => ({
          id: uuid(key + name),
          group_id: uuid(key + "extras"),
          name,
          description: "Opção fictícia gratuita para testar a montagem",
          price: 0,
          is_active: true,
          sort_order: i,
        })),
      });
    products.set(key, {
      id,
      category_id: categories[catIndex].id,
      name: nameMap[key] || originalName,
      slug: key,
      description: lines.slice(1).find((l) => !/^R\$|^Serve|^Observa/.test(l)) || null,
      price: prices[0],
      price_from: false,
      weight: null,
      quantity_label: copo ? (key.includes("300") ? "300 ml" : "500 ml") : null,
      serves: text.includes("Serve 3 pessoas") ? 3 : null,
      is_active: true,
      is_sold_out: false,
      is_featured: path.includes("Mais Pedidos") || copo,
      featured_order: copo ? 0 : products.size,
      sort_order: products.size,
      product_images: images,
      addon_groups: addons,
      promotions:
        prices.length > 1
          ? [
              {
                id: uuid(key + "promo"),
                title: "Preço do material fornecido",
                promo_price: prices.at(-1),
                discount_percent: null,
                starts_at: null,
                ends_at: null,
                is_active: true,
              },
            ]
          : [],
      source_categories: [basename(resolve(dir, ".."))],
    });
  }
}
await scan(source);
const store = {
  store_name: "Açaí Labor",
  tagline: "Mais sabor no seu dia.",
  description:
    "Açaí cremoso, cupuaçu e sorvetes. Do seu copo favorito ao tamanho para compartilhar.",
  logo_url: null,
  banner_url: null,
  address_line: "Vila Nova Galvão · São Paulo",
  delivery_time_min: 21,
  delivery_time_max: 55,
  delivery_fee: 5,
  whatsapp: "",
  phone: "",
  opening_hours: "Horários a confirmar",
  is_open: true,
};
await mkdir("src/data", { recursive: true });
await writeFile(
  "src/data/labor-catalog.json",
  JSON.stringify(
    {
      store,
      categories,
      products: [...products.values()],
      coupons: [{ code: "LABOR10", percent: 10, min_total: 10, is_active: true }],
      orders: [],
    },
    null,
    2,
  ),
);
await writeFile("src/data/catalog-provenance.json", JSON.stringify(provenance, null, 2));
console.log(
  `Importados ${products.size} produtos únicos, ${provenance.length} registros de origem.`,
);
