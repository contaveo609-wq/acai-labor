import { createFileRoute } from "@tanstack/react-router";
import { SiteShell } from "@/components/SiteShell";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos de uso — Skina do Frango & Assados" },
      { name: "description", content: "Regras de uso da plataforma de pedidos online." },
      { property: "og:title", content: "Termos de uso — Skina do Frango & Assados" },
      { property: "og:description", content: "Regras de pedidos, entrega e cancelamento." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Termos,
});

function Termos() {
  return (
    <SiteShell>
      <article className="mx-auto max-w-2xl space-y-4 px-4 py-10 text-sm leading-relaxed text-muted-foreground">
        <h1 className="font-display text-4xl text-foreground">Termos de uso</h1>
        <p>
          Ao finalizar um pedido nesta plataforma, você confirma que os dados de contato e endereço
          informados estão corretos.
        </p>
        <p>
          O tempo de entrega exibido é uma estimativa e pode variar conforme demanda, clima e trânsito. O
          pagamento é realizado no ato da entrega nas formas indicadas no checkout.
        </p>
        <p>
          Cancelamentos devem ser solicitados o quanto antes pelo WhatsApp +55 66 8105-5779. Pedidos já em
          preparo podem não ser cancelados.
        </p>
        <p>Preços, disponibilidade e promoções podem mudar sem aviso prévio.</p>
      </article>
    </SiteShell>
  );
}
