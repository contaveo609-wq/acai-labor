import { useState } from "react";
import { toast } from "sonner";
import type { AdminSnapshot } from "@/lib/labor.types";
import type { DeliveryDriver } from "@/lib/delivery";
import { laborSaveDriver, laborAssignDriver } from "@/lib/labor.functions";
import { formatBRL } from "@/lib/menu";

export function LaborDrivers({ db, refresh }: { db: AdminSnapshot; refresh: () => Promise<void> }) {
  const [editing, setEditing] = useState<DeliveryDriver>({ id: crypto.randomUUID(), name: "", phone: "", active: true, feePerDelivery: 0, dailyFee: 0 });
  const [orderId, setOrderId] = useState("");
  const [driverId, setDriverId] = useState("");
  const [busy, setBusy] = useState(false);
  const orders = db.orders.filter((order) => order.fulfillment === "delivery" && ["pronto", "saiu_entrega"].includes(order.status));
  const active = (db.drivers || []).filter((driver) => driver.active);
  const payouts = new Map<string, { driverId: string; day: string; deliveries: number; fees: number; dailyFee: number }>();
  for (const item of db.driverAssignments || []) {
    if (!item.deliveredAt) continue;
    const day = item.deliveredAt.slice(0, 10), key = `${item.driverId}:${day}`;
    const summary = payouts.get(key) || { driverId: item.driverId, day, deliveries: 0, fees: 0, dailyFee: item.dailyFee };
    summary.deliveries++;
    summary.fees += item.feePerDelivery;
    summary.dailyFee = Math.max(summary.dailyFee, item.dailyFee);
    payouts.set(key, summary);
  }
  async function run(task: () => Promise<unknown>) {
    setBusy(true);
    try { await task(); await refresh(); toast.success("Dados de entrega atualizados."); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível salvar."); }
    finally { setBusy(false); }
  }
  return <section className="admin-box">
    <h3>Entregadores e expedição</h3>
    <p>Cadastre entregadores, atribua pedidos prontos e confira pagamento por entrega concluída. Nesta instalação os pedidos são de teste.</p>
    <form className="admin-form-grid" onSubmit={(event) => { event.preventDefault(); void run(() => laborSaveDriver({ data: editing })); }}>
      <label>Nome<input required minLength={2} maxLength={100} value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} /></label>
      <label>Telefone com DDD<input required inputMode="tel" value={editing.phone} onChange={(event) => setEditing({ ...editing, phone: event.target.value.replace(/\D/g, "") })} /></label>
      <label>Valor por entrega (R$)<input type="number" min="0" step="0.01" value={editing.feePerDelivery} onChange={(event) => setEditing({ ...editing, feePerDelivery: Number(event.target.value) })} /></label>
      <label>Diária (R$)<input type="number" min="0" step="0.01" value={editing.dailyFee} onChange={(event) => setEditing({ ...editing, dailyFee: Number(event.target.value) })} /></label>
      <label><input type="checkbox" checked={editing.active} onChange={(event) => setEditing({ ...editing, active: event.target.checked })} /> Ativo</label>
      <button disabled={busy}>Salvar entregador</button>
      <button type="button" onClick={() => setEditing({ id: crypto.randomUUID(), name: "", phone: "", active: true, feePerDelivery: 0, dailyFee: 0 })}>Novo cadastro</button>
    </form>
    <h3>Equipe</h3>
    {!db.drivers?.length && <p>Nenhum entregador cadastrado.</p>}
    {(db.drivers || []).map((driver) => <button key={driver.id} type="button" className="block text-left" onClick={() => setEditing(driver)}>{driver.name} · {driver.active ? "ativo" : "inativo"} · {formatBRL(driver.feePerDelivery)} por entrega</button>)}
    <h3>Pedidos para expedição</h3>
    {!orders.length && <p>Nenhum pedido de entrega pronto.</p>}
    {orders.length > 0 && <form className="admin-form-grid" onSubmit={(event) => { event.preventDefault(); if (orderId && driverId) void run(() => laborAssignDriver({ data: { orderId, driverId } })); }}>
      <label>Pedido<select required value={orderId} onChange={(event) => setOrderId(event.target.value)}><option value="">Selecione</option>{orders.map((order) => <option value={order.id} key={order.id}>#{order.order_number} · {order.customer_name} · {order.neighborhood}</option>)}</select></label>
      <label>Entregador<select required value={driverId} onChange={(event) => setDriverId(event.target.value)}><option value="">Selecione</option>{active.map((driver) => <option value={driver.id} key={driver.id}>{driver.name}</option>)}</select></label>
      <button disabled={busy || !orderId || !driverId}>Atribuir entrega</button>
    </form>}
    {orders.map((order) => { const assignment = db.driverAssignments?.find((item) => item.orderId === order.id); const driver = db.drivers?.find((item) => item.id === assignment?.driverId); return <p key={order.id}>#{order.order_number} · {order.status} · {driver ? `Entregador: ${driver.name}` : "Sem entregador"}</p>; })}
    <h3>Resumo por dia</h3>
    {!payouts.size && <p>Nenhuma entrega concluída com atribuição.</p>}
    {[...payouts.values()].sort((a,b) => b.day.localeCompare(a.day)).map((summary) => <p key={`${summary.driverId}:${summary.day}`}>{summary.day} · {db.drivers?.find((driver) => driver.id === summary.driverId)?.name || "Entregador"} · {summary.deliveries} entrega(s) · {formatBRL(summary.fees + summary.dailyFee)} incluindo diária</p>)}
  </section>;
}
