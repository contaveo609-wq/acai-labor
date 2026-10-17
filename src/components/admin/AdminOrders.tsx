import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, ORDER_STATUS_LABEL, PAYMENT_LABEL, whatsappLink } from "@/lib/menu";
import { Button } from "@/components/ui/button";

const STATUSES = ["recebido", "confirmado", "em_preparacao", "saiu_entrega", "entregue", "cancelado"] as const;

export function AdminOrders() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<string>("ativos");

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["admin-orders"],
    refetchInterval: 15000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(*, order_item_addons(*))")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("orders")
        .update({ status: status as never })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status atualizado");
      void queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-finance"] });
    },
    onError: () => toast.error("Não foi possível atualizar o status"),
  });

  const visible = orders.filter((o) => {
    if (filter === "ativos") return !["entregue", "cancelado"].includes(o.status as string);
    if (filter === "todos") return true;
    return o.status === filter;
  });

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {["ativos", "todos", ...STATUSES].map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${
              filter === value ? "border-primary bg-primary text-primary-foreground" : "border-border"
            }`}
          >
            {ORDER_STATUS_LABEL[value] ?? (value === "ativos" ? "Em andamento" : "Todos")}
          </button>
        ))}
      </div>

      {isLoading ? <p className="mt-6 text-muted-foreground">Carregando pedidos...</p> : null}
      {!isLoading && visible.length === 0 ? (
        <p className="mt-6 text-muted-foreground">Nenhum pedido nesta visualização.</p>
      ) : null}

      <ul className="mt-4 space-y-3">
        {visible.map((order) => (
          <li key={order.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-display text-2xl">#{order.order_number}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(order.created_at as string).toLocaleString("pt-BR")}
                </p>
              </div>
              <p className="font-display text-2xl text-primary">{formatBRL(Number(order.total))}</p>
            </div>

            <p className="mt-2 text-sm">
              <strong>{order.customer_name}</strong> — {order.customer_phone}
            </p>
            <p className="text-sm text-muted-foreground">
              {order.street}, {order.number}
              {order.complement ? ` — ${order.complement}` : ""} — {order.neighborhood}
              {order.reference ? ` (${order.reference})` : ""}
            </p>
            <p className="text-sm text-muted-foreground">
              Pagamento: {PAYMENT_LABEL[order.payment_method as string] ?? order.payment_method}
              {order.change_for ? ` — troco para ${formatBRL(Number(order.change_for))}` : ""}
            </p>
            {order.notes ? <p className="text-sm italic text-muted-foreground">Obs.: {order.notes}</p> : null}

            <ul className="mt-2 border-t border-border pt-2 text-sm">
              {(order.order_items ?? []).map((item) => (
                <li key={item.id}>
                  {item.quantity}x {item.product_name} — {formatBRL(Number(item.line_total))}
                  {(item.order_item_addons ?? []).map((addon) => (
                    <span key={addon.id} className="block pl-4 text-xs text-muted-foreground">
                      + {addon.quantity}x {addon.name}
                    </span>
                  ))}
                  {item.notes ? (
                    <span className="block pl-4 text-xs italic text-muted-foreground">{item.notes}</span>
                  ) : null}
                </li>
              ))}
            </ul>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <select
                aria-label={`Status do pedido ${order.order_number}`}
                value={order.status as string}
                onChange={(e) => updateStatus.mutate({ id: order.id, status: e.target.value })}
                className="h-9 rounded-lg border border-border bg-background px-2 text-sm"
              >
                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {ORDER_STATUS_LABEL[status]}
                  </option>
                ))}
              </select>
              <Button asChild size="sm" variant="outline">
                <a
                  href={whatsappLink(
                    order.customer_phone as string,
                    `Olá ${order.customer_name}! Sobre seu pedido #${order.order_number} na Skina do Frango & Assados:`,
                  )}
                  target="_blank"
                  rel="noreferrer"
                >
                  WhatsApp do cliente
                </a>
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
