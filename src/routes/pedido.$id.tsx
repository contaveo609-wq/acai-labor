import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { SiteShell } from "@/components/SiteShell";
import {
  fetchStoreSettings,
  formatBRL,
  ORDER_STATUS_LABEL,
  PAYMENT_LABEL,
  whatsappLink,
} from "@/lib/menu";
import { getOrder } from "@/lib/orders.functions";
import { DEMO_MODE } from "@/lib/demo";
import { laborGetOrder } from "@/lib/labor.functions";
import { FINANCIAL_LABELS } from "@/lib/vendrex.rules";

export const Route = createFileRoute("/pedido/$id")({
  head: () =>
    DEMO_MODE
      ? {
          meta: [
            { title: "Seu pedido — Açaí Labor" },
            {
              name: "description",
              content: "Acompanhe seu pedido da Açaí Labor.",
            },
            { name: "robots", content: "noindex, nofollow" },
          ],
        }
      : {
          meta: [
            {
              title: DEMO_MODE
                ? "Acompanhe seu pedido — Açaí Labor"
                : "Acompanhe seu pedido — Skina do Frango & Assados",
            },
            { name: "description", content: "Acompanhe o status do seu pedido em tempo real." },
            { property: "og:title", content: "Acompanhe seu pedido — Skina do Frango & Assados" },
            { property: "og:description", content: "Status, itens e total do seu pedido." },
            { property: "og:type", content: "website" },
            { name: "twitter:card", content: "summary" },
            { name: "robots", content: "noindex" },
          ],
        },
  component: OrderPage,
});

const STEPS = DEMO_MODE
  ? ["recebido", "em_preparacao", "pronto", "saiu_entrega", "entregue", "concluido"]
  : ["recebido", "confirmado", "em_preparacao", "saiu_entrega", "entregue"];

function OrderPage() {
  const { id } = Route.useParams();
  const fetchOrder = useServerFn(getOrder);
  const { data: store } = useQuery({ queryKey: ["store"], queryFn: fetchStoreSettings });
  const { data: order, isLoading } = useQuery({
    queryKey: ["order", id],
    queryFn: async () =>
      DEMO_MODE ? laborGetOrder({ data: { id } }) : fetchOrder({ data: { id } }),
    refetchInterval: DEMO_MODE ? 5000 : 20000,
  });

  if (isLoading) {
    return (
      <SiteShell>
        <p className="p-10 text-center text-muted-foreground">Carregando pedido...</p>
      </SiteShell>
    );
  }

  if (!order) {
    return (
      <SiteShell>
        <div className="p-10 text-center">
          <p className="text-muted-foreground">Pedido não encontrado.</p>
          <Link to="/" className="mt-3 inline-block font-semibold text-primary">
            Voltar ao início
          </Link>
        </div>
      </SiteShell>
    );
  }

  const currentStep = STEPS.indexOf(order.status as string);
  const wa = store?.whatsapp ?? (DEMO_MODE ? "" : "556681055779");
  const pickup = DEMO_MODE && "fulfillment" in order && order.fulfillment === "pickup";

  return (
    <SiteShell>
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="rounded-2xl border border-border bg-card p-5 text-center">
          <p className="text-sm text-muted-foreground">
            {DEMO_MODE ? "Pedido de teste · sem cobrança" : "Pedido"}
          </p>
          <h1 className="font-display text-5xl text-primary">#{order.order_number}</h1>
          <p className="mt-2 inline-block rounded-full bg-success px-3 py-1 text-sm font-semibold text-success-foreground">
            {ORDER_STATUS_LABEL[order.status as string] ?? order.status}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {pickup
              ? "Retirada simulada na loja"
              : `Entrega estimada: ${store?.delivery_time_min ?? 0}–${store?.delivery_time_max ?? 0} minutos${DEMO_MODE ? " · referência, sem entrega real" : ""}`}
          </p>
        </div>

        {order.status !== "cancelado" ? (
          <ol className="mt-5 space-y-2">
            {STEPS.filter((s) => !pickup || !["saiu_entrega", "entregue"].includes(s)).map(
              (step, index) => (
                <li
                  key={step}
                  className={`flex items-center gap-3 rounded-xl border p-3 text-sm ${
                    STEPS.indexOf(step) <= currentStep
                      ? "border-primary/40 bg-primary/5 font-semibold text-primary"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                      STEPS.indexOf(step) <= currentStep
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    {index + 1}
                  </span>
                  {ORDER_STATUS_LABEL[step]}
                </li>
              ),
            )}
          </ol>
        ) : (
          <p className="mt-5 rounded-xl bg-destructive/10 p-4 text-center text-destructive">
            Este pedido foi cancelado.
          </p>
        )}

        <section className="mt-5 rounded-2xl border border-border bg-card p-4">
          <h2 className="font-display text-2xl">Itens</h2>
          <ul className="mt-2 space-y-2 text-sm">
            {(order.order_items ?? []).map((item) => (
              <li key={item.id}>
                <div className="flex justify-between gap-3">
                  <span>
                    {item.quantity}x {item.product_name}
                  </span>
                  <span>{formatBRL(Number(item.line_total))}</span>
                </div>
                {(item.order_item_addons ?? []).map((addon) => (
                  <p key={addon.id} className="pl-4 text-xs text-muted-foreground">
                    + {addon.quantity}x {addon.name}
                  </p>
                ))}
                {item.notes ? (
                  <p className="pl-4 text-xs italic text-muted-foreground">Obs.: {item.notes}</p>
                ) : null}
              </li>
            ))}
          </ul>
          <div className="mt-3 space-y-1 border-t border-border pt-2 text-sm">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{formatBRL(Number(order.subtotal))}</span>
            </div>
            <div className="flex justify-between">
              <span>Taxa de entrega</span>
              <span>{formatBRL(Number(order.delivery_fee))}</span>
            </div>
            <div className="flex justify-between font-display text-2xl">
              <span>Total</span>
              <span className="text-primary">{formatBRL(Number(order.total))}</span>
            </div>
          </div>
          {Number(order.discount) > 0 && (
            <p className="text-sm text-primary">
              Desconto aplicado: {formatBRL(Number(order.discount))}
            </p>
          )}
          <p className="mt-2 text-sm text-muted-foreground">
            Pagamento: {PAYMENT_LABEL[order.payment_method as string] ?? order.payment_method}
          </p>
          {"payment_status" in order && (
            <p className="financial-badge">
              {FINANCIAL_LABELS[String(order.payment_status || "pendente")]}
            </p>
          )}
          {"scheduled_for" in order && order.scheduled_for && (
            <p className="text-sm mt-3">
              Agendado para{" "}
              {new Date(String(order.scheduled_for)).toLocaleString("pt-BR", {
                timeZone: "America/Sao_Paulo",
              })}
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            {pickup ? "Retirada na loja." : `Entregar em: ${order.street}, ${order.number}`}
            {order.complement ? ` — ${order.complement}` : ""} — {order.neighborhood}
          </p>
        </section>

        {wa && (
          <a
            href={whatsappLink(wa, `Olá! Quero falar sobre o pedido #${order.order_number}.`)}
            target="_blank"
            rel="noreferrer"
            className="mt-4 flex h-12 items-center justify-center rounded-full bg-success font-semibold text-success-foreground"
          >
            Falar sobre este pedido no WhatsApp
          </a>
        )}
        {DEMO_MODE && (
          <p className="mt-5 text-xs text-muted-foreground text-center">
            Acompanhe a mudança de status nesta página.
          </p>
        )}
      </div>
    </SiteShell>
  );
}
