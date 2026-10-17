import { DEMO_MODE } from "@/lib/demo";
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteShell } from "@/components/SiteShell";
import { MenuBrowser } from "@/components/MenuBrowser";

export const Route = createFileRoute("/cardapio")({
  head: () =>
    DEMO_MODE
      ? {
          meta: [
            { title: "Cardápio — Açaí Labor" },
            {
              name: "description",
              content: "Cardápio da Açaí Labor para entrega ou retirada.",
            },
            { name: "robots", content: "noindex, nofollow" },
          ],
        }
      : {
          meta: [
            {
              title: DEMO_MODE
                ? "Cardápio completo — Açaí Labor"
                : "Cardápio completo — Skina do Frango & Assados",
            },
            {
              name: "description",
              content:
                "Veja todos os combos, carnes na brasa, acompanhamentos e bebidas da Skina do Frango & Assados e peça online.",
            },
            { property: "og:title", content: "Cardápio — Skina do Frango & Assados" },
            {
              property: "og:description",
              content: "Combos, costela no bafo, fraldinha, acompanhamentos e bebidas com entrega.",
            },
            { property: "og:type", content: "website" },
            { name: "twitter:card", content: "summary_large_image" },
          ],
        },
  component: Cardapio,
});

function Cardapio() {
  const [search, setSearch] = useState("");
  return (
    <SiteShell search={search} onSearchChange={setSearch}>
      <div className="mx-auto max-w-6xl px-3 py-6 sm:px-5">
        <h1 className="font-display text-4xl text-foreground">Catálogo</h1>
        <p className="mb-4 text-sm text-muted-foreground">
          {DEMO_MODE
            ? "Encontre produtos, compare formatos e monte seu pedido."
            : "Escolha seus assados favoritos e monte seu pedido."}
        </p>
        <MenuBrowser search={search} />
      </div>
    </SiteShell>
  );
}
