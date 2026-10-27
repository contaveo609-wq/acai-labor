import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import type { AdminSnapshot, LaborOrder } from "@/lib/labor.types";
import { STATUSES } from "@/lib/labor.schema";
import { FINANCIAL_LABELS, paymentStatusLabel, nextStatuses } from "@/lib/vendrex.rules";
import { formatBRL, ORDER_STATUS_LABEL, PAYMENT_LABEL } from "@/lib/menu";
import { laborAddNote, laborPayment, laborStatus } from "@/lib/labor.functions";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const date = (s: string) => new Date(s).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
export function VendrexOrders({
  db,
  refresh,
}: {
  db: AdminSnapshot;
  refresh: () => Promise<void>;
}) {
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState("");
  const [day, setDay] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<LaborOrder | null>(null);
  const [source, setSource] = useState("");
  const [printMode, setPrintMode] = useState("detailed");
  const [sector, setSector] = useState("");
  const order = db.orders.find((o) => o.id === selected);
  useEffect(() => {
    if (receipt) window.print();
  }, [receipt]);
  const filtered = db.orders.filter(
    (o) =>
      (!mode || o.fulfillment === mode) &&
      (!source || (o.source || "site") === source) &&
      (!day ||
        new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(
          new Date(o.created_at),
        ) === day) &&
      `${o.order_number} ${o.customer_name} ${o.customer_phone}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  async function change(o: LaborOrder, status: string) {
    setBusy(true);
    try {
      await laborStatus({ data: { id: o.id, status, expected: o.status, reason } });
      await refresh();
      setReason("");
      toast.success("Etapa atualizada; situação financeira preservada.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao atualizar.");
    } finally {
      setBusy(false);
    }
  }
  async function changePayment(o: LaborOrder, status: "pago" | "recusado" | "pendente") {
    setBusy(true);
    try {
      await laborPayment({ data: { id: o.id, status, expected: o.payment_status || "pendente" } });
      await refresh();
      toast.success("Pagamento atualizado manualmente.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao atualizar pagamento.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <p className="text-xs text-muted-foreground mb-4">
        Pedidos de teste · atualização a cada 8 segundos · confira o recebimento antes de confirmar
        qualquer pagamento.
      </p>
      <div className="order-filters">
        <select
          aria-label="Origem do pedido"
          value={source}
          onChange={(e) => setSource(e.target.value)}
        >
          <option value="">Todas as origens</option>
          <option value="site">Site</option>
          <option value="whatsapp">WhatsApp</option>
        </select>
        <select
          aria-label="Formato de impressão"
          value={printMode}
          onChange={(e) => setPrintMode(e.target.value)}
        >
          <option value="detailed">Impressão detalhada</option>
          <option value="summary">Impressão resumida</option>
        </select>
        <select
          aria-label="Setor de impressão"
          value={sector}
          onChange={(e) => setSector(e.target.value)}
        >
          <option value="">Todos os setores</option>
          {db.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input
          aria-label="Buscar pedidos"
          placeholder="Número, cliente ou telefone"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label="Tipo de recebimento"
          value={mode}
          onChange={(e) => setMode(e.target.value)}
        >
          <option value="">Entrega e retirada</option>
          <option value="delivery">Entrega</option>
          <option value="pickup">Retirada</option>
        </select>
        <input
          aria-label="Data do pedido"
          type="date"
          value={day}
          onChange={(e) => setDay(e.target.value)}
        />
      </div>
      <div className="admin-kanban">
        {STATUSES.map((status) => (
          <section key={status} className="admin-kanban-column">
            <h3>
              {ORDER_STATUS_LABEL[status]}
              <span>{filtered.filter((o) => o.status === status).length}</span>
            </h3>
            {filtered
              .filter((o) => o.status === status)
              .slice()
              .reverse()
              .map((o) => (
                <article className="admin-order" key={o.id}>
                  <div className="flex justify-between">
                    <strong>#{o.order_number}</strong>
                    <span>{formatBRL(o.total)}</span>
                  </div>
                  <p>
                    {o.customer_name}
                    <br />
                    {date(o.created_at)}
                  </p>
                  <span className="financial-badge">{paymentStatusLabel(o)}</span>
                  <p>
                    {o.fulfillment === "pickup" ? "Retirada" : "Entrega"} · {o.order_items.length}{" "}
                    itens
                    {o.scheduled_for && (
                      <>
                        <br />
                        Agendado: {date(o.scheduled_for)}
                      </>
                    )}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelected(o.id);
                      setNote("");
                      setReason("");
                    }}
                  >
                    Abrir pedido #{o.order_number}
                  </Button>
                </article>
              ))}
            {!filtered.some((o) => o.status === status) && (
              <p className="admin-empty">Nenhum pedido nesta etapa.</p>
            )}
          </section>
        ))}
      </div>
      <Dialog open={!!order} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogTitle>Pedido #{order?.order_number}</DialogTitle>
          <DialogDescription>Operação e financeiro acompanhados separadamente.</DialogDescription>
          {order && (
            <>
              <Receipt order={order} store={db.store.store_name} />
              <section className="order-history">
                <h3>Pagamento</h3>
                <p>
                  {PAYMENT_LABEL[order.payment_method] || order.payment_method} ·{" "}
                  {paymentStatusLabel(order)}
                </p>
                {order.payment_method === "pix" && (
                  <p>
                    Chave CNPJ 21572534000162 · confira o valor de {formatBRL(order.total)} no Itaú.
                    A declaração do cliente não comprova o crédito.
                  </p>
                )}
                {["credito_entrega", "debito_entrega"].includes(order.payment_method) && (
                  <p>
                    Levar maquininha para {order.fulfillment === "pickup" ? "retirada" : "entrega"}.
                  </p>
                )}
                {order.payment_declared_at && (
                  <p>Cliente declarou Pix em {date(order.payment_declared_at)}.</p>
                )}
                <div className="flex flex-wrap gap-2 mt-3">
                  {order.payment_status === "em_analise" && order.payment_method === "pix" && (
                    <>
                      <Button disabled={busy} onClick={() => changePayment(order, "pago")}>
                        Confirmar após conferir Itaú
                      </Button>
                      <Button
                        disabled={busy}
                        variant="outline"
                        onClick={() => changePayment(order, "recusado")}
                      >
                        Pagamento não localizado
                      </Button>
                    </>
                  )}
                  {order.payment_status === "recusado" && (
                    <Button
                      disabled={busy}
                      variant="outline"
                      onClick={() => changePayment(order, "pendente")}
                    >
                      Reabrir para declaração
                    </Button>
                  )}
                  {order.payment_status === "pendente" &&
                    ["credito_entrega", "debito_entrega", "dinheiro"].includes(
                      order.payment_method,
                    ) && (
                      <Button
                        disabled={
                          busy ||
                          (["credito_entrega", "debito_entrega"].includes(order.payment_method) &&
                            !["entregue", "concluido"].includes(order.status))
                        }
                        onClick={() => changePayment(order, "pago")}
                      >
                        Confirmar recebimento presencial
                      </Button>
                    )}
                </div>
                {order.payment_history?.map((event, i) => (
                  <p key={`${event.at}-${i}`}>
                    {FINANCIAL_LABELS[event.status] || event.status} · {date(event.at)} ·{" "}
                    {event.actor}
                  </p>
                ))}
              </section>
              <div className="order-actions">
                {nextStatuses(order)
                  .filter((s) => s !== "cancelado")
                  .map((s) => (
                    <Button key={s} disabled={busy} onClick={() => change(order, s)}>
                      Avançar: {ORDER_STATUS_LABEL[s]}
                    </Button>
                  ))}
                <Button variant="outline" onClick={() => setReceipt({ ...order })}>
                  Imprimir pedido
                </Button>
              </div>
              {nextStatuses(order).includes("cancelado") && (
                <form
                  className="order-cancel"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void change(order, "cancelado");
                  }}
                >
                  <label htmlFor="cancel-reason">Motivo do cancelamento</label>
                  <input
                    id="cancel-reason"
                    required
                    minLength={3}
                    maxLength={300}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                  <Button variant="destructive" disabled={busy}>
                    Cancelar pedido
                  </Button>
                </form>
              )}
              <section className="order-history">
                <h3>Histórico operacional</h3>
                {order.history.map((h, i) => (
                  <p key={`${h.at}-${i}`}>
                    <b>{ORDER_STATUS_LABEL[h.status] || h.status}</b> · {date(h.at)} ·{" "}
                    {h.actor || "Registro V1"}
                    {h.reason && <span className="block">{h.reason}</span>}
                  </p>
                ))}
              </section>
              <section className="order-history">
                <h3>Notas internas</h3>
                <p className="text-muted-foreground">Visíveis apenas no painel.</p>
                {order.internal_notes?.map((n, i) => (
                  <p key={i}>
                    {n.text}
                    <small className="block">
                      {date(n.at)} · {n.actor}
                    </small>
                  </p>
                ))}
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setBusy(true);
                    try {
                      await laborAddNote({ data: { id: order.id, text: note } });
                      await refresh();
                      setNote("");
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Falha ao salvar nota");
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <textarea
                    aria-label="Nova nota interna"
                    required
                    maxLength={1000}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                  <Button variant="outline" disabled={busy}>
                    Adicionar nota
                  </Button>
                </form>
              </section>
            </>
          )}
        </DialogContent>
      </Dialog>
      {receipt &&
        createPortal(
          <div id="vendrex-receipt">
            <Receipt
              order={{
                ...receipt,
                order_items: receipt.order_items.filter(
                  (i) =>
                    !sector ||
                    db.products.some((p) => p.id === i.product_id && p.category_id === sector),
                ),
              }}
              store={db.store.store_name}
              summary={printMode === "summary"}
            />
          </div>,
          document.body,
        )}
    </>
  );
}
function Receipt({
  order: o,
  store,
  summary = false,
}: {
  order: LaborOrder;
  store: string;
  summary?: boolean;
}) {
  return (
    <div className="order-receipt">
      <h3>
        {store} · #{o.order_number}
      </h3>
      <p>TESTE · SEM COBRANÇA · NÃO É DOCUMENTO FISCAL</p>
      <p>Origem: {o.source === "whatsapp" ? "WhatsApp" : "Site"}</p>
      <p>
        {o.customer_name} · {o.customer_phone}
        <br />
        {date(o.created_at)} ·{" "}
        {o.fulfillment === "pickup"
          ? "Retirada na loja"
          : `${o.street}, ${o.number} · ${o.neighborhood}`}{" "}
        {o.complement}
      </p>
      {o.scheduled_for && <p>Agendado: {date(o.scheduled_for)}</p>}
      <ul>
        {o.order_items.map((i) => (
          <li key={i.id}>
            <b>
              {i.quantity} × {i.product_name}
            </b>
            <span>{formatBRL(i.line_total)}</span>
            <small>
              {i.sale_label || "Unidade"}
              {i.notes && ` · ${i.notes}`}
            </small>
            {!summary &&
              i.order_item_addons.map((a) => (
                <small key={a.id}>
                  + {a.quantity} × {a.name} ({formatBRL(a.price)})
                </small>
              ))}
          </li>
        ))}
      </ul>
      <p>
        Subtotal: {formatBRL(o.subtotal)} · Descontos: {formatBRL(o.discount)} · Entrega:{" "}
        {formatBRL(o.delivery_fee)}
      </p>
      <strong>Total: {formatBRL(o.total)}</strong>
      <p>
        {PAYMENT_LABEL[o.payment_method]} · {paymentStatusLabel(o)}
        {o.change_for != null && ` · Troco para ${formatBRL(o.change_for)}`}
      </p>
      {o.notes && <p>Observações: {o.notes}</p>}
      {o.reference && <p>Referência: {o.reference}</p>}
    </div>
  );
}
