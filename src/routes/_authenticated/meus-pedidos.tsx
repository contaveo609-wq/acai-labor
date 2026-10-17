import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { SiteShell } from "@/components/SiteShell";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, ORDER_STATUS_LABEL } from "@/lib/menu";

export const Route = createFileRoute("/_authenticated/meus-pedidos")({
  head: () => ({
    meta: [
      { title: "Meus pedidos — Skina do Frango & Assados" },
      { name: "description", content: "Histórico e status dos seus pedidos." },
      { property: "og:title", content: "Meus pedidos — Skina do Frango & Assados" },
      { property: "og:description", content: "Histórico e status dos seus pedidos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MyOrders,
});

function MyOrders() {
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["my-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_number, status, total, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <SiteShell>
      <div className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="font-display text-4xl">Meus pedidos</h1>
        {isLoading ? <p className="mt-6 text-muted-foreground">Carregando...</p> : null}
        {!isLoading && orders.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-border bg-card p-8 text-center">
            <p className="text-muted-foreground">Você ainda não fez pedidos.</p>
            <Link to="/cardapio" className="mt-3 inline-block font-semibold text-primary">
              Ver cardápio
            </Link>
          </div>
        ) : null}
        <ul className="mt-5 space-y-3">
          {orders.map((order) => (
            <li key={order.id}>
              <Link
                to="/pedido/$id"
                params={{ id: order.id }}
                className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
              >
                <div>
                  <p className="font-display text-2xl">#{order.order_number}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(order.created_at as string).toLocaleString("pt-BR")}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-primary">{formatBRL(Number(order.total))}</p>
                  <p className="text-xs text-muted-foreground">
                    {ORDER_STATUS_LABEL[order.status as string] ?? order.status}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </SiteShell>
  );
}
