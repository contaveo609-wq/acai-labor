import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ProductCard } from "@/components/ProductCard";
import { ProductDialog } from "@/components/ProductDialog";
import { fetchCategories, fetchProducts, effectivePrice, type Product } from "@/lib/menu";
import { UNIT_LABELS } from "@/lib/vendrex.rules";
import { DEMO_MODE } from "@/lib/demo";
import { Skeleton } from "./ui/skeleton";

export function MenuBrowser({ search }: { search: string }) {
  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  });
  const {
    data: products = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({ queryKey: ["products"], queryFn: fetchProducts });
  const [active, setActive] = useState<string | null>(null);
  const [selected, setSelected] = useState<Product | null>(null);
  const [unit, setUnit] = useState("");
  const [promosOnly, setPromosOnly] = useState(false);
  const [availableOnly, setAvailableOnly] = useState(false);
  const [sort, setSort] = useState("catalog");

  const normalize = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const term = normalize(search.trim());
  const visible = useMemo(
    () =>
      products
        .filter((p) => p.is_active && categories.some((c) => c.id === p.category_id && c.is_active))
        .filter(
          (p) =>
            !unit ||
            p.sale_unit === unit ||
            p.sale_options?.some((o) => o.is_active && o.unit === unit),
        )
        .filter((p) => !promosOnly || effectivePrice(p) < p.price)
        .filter((p) => !availableOnly || !p.is_sold_out)
        .filter((p) =>
          term
            ? normalize(
                `${p.name} ${p.description || ""} ${p.slug} ${p.sku || ""} ${p.quantity_label || ""}`,
              )
                .replace(/\s/g, "")
                .includes(term.replace(/\s/g, ""))
            : true,
        )
        .sort((a, b) =>
          sort === "price-up"
            ? effectivePrice(a) - effectivePrice(b)
            : sort === "price-down"
              ? effectivePrice(b) - effectivePrice(a)
              : a.sort_order - b.sort_order,
        ),
    [products, term, categories, unit, promosOnly, availableOnly, sort],
  );

  const featured = visible
    .filter((p) => p.is_featured)
    .sort((a, b) => a.featured_order - b.featured_order);

  const sections = categories
    .filter((c) => c.is_active)
    .map((c) => ({ category: c, items: visible.filter((p) => p.category_id === c.id) }))
    .filter((s) => s.items.length > 0);

  function scrollTo(slug: string) {
    setActive(slug);
    document.getElementById(`cat-${slug}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div>
      <div className="catalog-filters">
        <label>
          Formato
          <select
            aria-label="Filtrar por unidade"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
          >
            <option value="">Todos os formatos</option>
            {Object.entries(UNIT_LABELS).map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Ordenar
          <select
            aria-label="Ordenar catálogo"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="catalog">Seleção da loja</option>
            <option value="price-up">Menor preço</option>
            <option value="price-down">Maior preço</option>
          </select>
        </label>
        <label className="filter-check">
          <input
            type="checkbox"
            checked={promosOnly}
            onChange={(e) => setPromosOnly(e.target.checked)}
          />{" "}
          Em promoção
        </label>
        <label className="filter-check">
          <input
            type="checkbox"
            checked={availableOnly}
            onChange={(e) => setAvailableOnly(e.target.checked)}
          />{" "}
          Disponíveis
        </label>
      </div>
      <nav
        aria-label="Categorias"
        className="menu-categories sticky top-[104px] z-30 -mx-3 mb-4 flex gap-2 overflow-x-auto bg-background/95 px-3 py-2 backdrop-blur sm:top-[108px]"
      >
        {term ? null : (
          <>
            {featured.length ? (
              <CategoryChip
                label={DEMO_MODE ? "✦ Em destaque" : "🔥 Mais pedidos"}
                active={active === "mais-pedidos"}
                onClick={() => scrollTo("mais-pedidos")}
              />
            ) : null}
            {sections.map((s) => (
              <CategoryChip
                key={s.category.id}
                label={`${s.category.emoji ?? ""} ${s.category.name}`.trim()}
                active={active === s.category.slug}
                onClick={() => scrollTo(s.category.slug)}
              />
            ))}
          </>
        )}
      </nav>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-44 rounded-2xl" />
          ))}
        </div>
      ) : null}
      {isError && (
        <div role="alert" className="rounded-xl border p-6">
          Não foi possível carregar o cardápio.{" "}
          <button className="underline" onClick={() => refetch()}>
            Tentar novamente
          </button>
        </div>
      )}

      {!isLoading && !isError && visible.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">
          Nenhum item encontrado{search ? ` para "${search}"` : " com estes filtros"}.
        </p>
      ) : null}

      {!term && featured.length ? (
        <section id="cat-mais-pedidos" className="scroll-mt-40">
          <div className="section-title">
            <h2 className="font-display text-3xl text-foreground">
              {DEMO_MODE ? "Destaques da Açaí Labor" : "🔥 Mais pedidos"}
            </h2>
            {DEMO_MODE && <span>Uma boa escolha para começar ✦</span>}
          </div>
          <div
            className={
              DEMO_MODE
                ? "featured-products mt-5 grid gap-4 sm:grid-cols-3"
                : "mt-3 grid gap-3 sm:grid-cols-2"
            }
          >
            {(DEMO_MODE ? featured.slice(0, 3) : featured).map((p) => (
              <ProductCard key={`f-${p.id}`} product={p} onClick={() => setSelected(p)} />
            ))}
          </div>
        </section>
      ) : null}

      {term ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {visible.map((p) => (
            <ProductCard key={p.id} product={p} onClick={() => setSelected(p)} />
          ))}
        </div>
      ) : (
        sections.map((s) => (
          <section key={s.category.id} id={`cat-${s.category.slug}`} className="mt-10 scroll-mt-40">
            <h2 className="font-display text-3xl text-foreground">
              {s.category.emoji ? `${s.category.emoji} ` : ""}
              {s.category.name}
            </h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {s.items.map((p) => (
                <ProductCard key={p.id} product={p} onClick={() => setSelected(p)} />
              ))}
            </div>
          </section>
        ))
      )}

      <ProductDialog
        product={selected}
        products={products}
        onProductChange={setSelected}
        open={selected !== null}
        onOpenChange={(open) => !open && setSelected(null)}
      />
    </div>
  );
}

function CategoryChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 whitespace-nowrap rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-foreground hover:border-primary/50"
      }`}
    >
      {label}
    </button>
  );
}
