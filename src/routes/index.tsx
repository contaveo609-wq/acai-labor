import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { SiteShell } from "@/components/SiteShell";
import { MenuBrowser } from "@/components/MenuBrowser";
import { fetchStoreSettings } from "@/lib/menu";
import { DEMO_MODE } from "@/lib/demo";
import { LaborHome } from "@/components/LaborHome";

export const Route = createFileRoute("/")({
  head: () =>
    DEMO_MODE
      ? {
          meta: [
            { title: "Açaí Labor · Pedidos online" },
            {
              name: "description",
              content: "Açaí, cupuaçu, sorvetes, pizzas e muito mais para o seu pedido.",
            },
            { name: "robots", content: "noindex, nofollow" },
          ],
        }
      : {
          meta: [
            {
              title: DEMO_MODE
                ? "Açaí Labor · Mais sabor no seu dia"
                : "Skina do Frango & Assados — Peça online em Rondonópolis/MT",
            },
            {
              name: "description",
              content:
                "Costela no bafo, capa do contra-filé, fraldinha e combos assados na brasa. Peça online com entrega no Jardim Primavera, Rondonópolis/MT.",
            },
            { property: "og:title", content: "Skina do Frango & Assados — Peça online" },
            {
              property: "og:description",
              content: "Assados na brasa, combos e acompanhamentos com entrega em Rondonópolis/MT.",
            },
            { property: "og:type", content: "website" },
            { name: "twitter:card", content: "summary_large_image" },
          ],
        },
  component: Home,
});

function Home() {
  if (DEMO_MODE) return <LaborHome />;
  return <OriginalHome />;
}
function OriginalHome() {
  const [search, setSearch] = useState("");
  const { data: store } = useQuery({ queryKey: ["store"], queryFn: fetchStoreSettings });

  return (
    <SiteShell search={search} onSearchChange={setSearch}>
      <section className="brand-gradient text-primary-foreground">
        <div className="mx-auto max-w-6xl px-5 py-10 text-center sm:py-14">
          {store?.logo_url ? (
            <img
              src={store.logo_url}
              alt="Logomarca Skina do Frango & Assados"
              width={128}
              height={128}
              className="mx-auto h-28 w-28 rounded-2xl object-cover ring-4 ring-gold/70"
            />
          ) : null}
          <h1 className="mt-4 font-display text-5xl leading-none sm:text-6xl">
            {store?.store_name ?? "Skina do Frango & Assados"}
          </h1>
          <p className="mt-2 text-lg text-gold">
            {store?.tagline ?? "Assados na brasa, do jeito que você gosta"}
          </p>
          <p className="mx-auto mt-3 max-w-2xl text-sm opacity-90">{store?.description}</p>
          <Link
            to="/cardapio"
            className="mt-6 inline-flex rounded-full bg-gold px-8 py-3 font-display text-2xl tracking-wide text-gold-foreground shadow-lg transition-transform hover:scale-105"
          >
            Ver cardápio completo
          </Link>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-3 py-8 sm:px-5">
        <MenuBrowser search={search} />
      </div>
    </SiteShell>
  );
}
