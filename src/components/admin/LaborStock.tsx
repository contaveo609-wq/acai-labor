import { useState } from "react";
import { toast } from "sonner";
import type { AdminSnapshot } from "@/lib/labor.types";
import { laborSaveStock } from "@/lib/labor.functions";

export function LaborStock({ db, refresh }: { db: AdminSnapshot; refresh: () => Promise<void> }) {
  const [productId, setProductId] = useState(db.products[0]?.id || "");
  const [saleOptionId, setSaleOptionId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [lowAt, setLowAt] = useState("");
  const [busy, setBusy] = useState(false);
  const product = db.products.find((item) => item.id === productId);
  const record = db.inventory?.find((item) => item.productId === productId && item.saleOptionId === (saleOptionId || null));
  const tracked = db.inventory || [];
  const low = tracked.filter((item) => item.quantity <= item.lowAt);
  const variants = product ? [{ id: "", label: `Unidade base (${product.sale_unit})` }, ...(product.sale_options || []).map((item) => ({ id: item.id, label: item.label }))] : [];
  return <section className="admin-box">
    <h3>Estoque</h3>
    <p>Cadastre quantidade por produto ou embalagem. Sem cadastro, venda continua sem controle quantitativo. Cada pedido reserva estoque; cancelamento devolve a quantidade.</p>
    <div className="admin-stats"><div className="admin-stat"><strong>{tracked.length}</strong><span>Variações controladas</span></div><div className="admin-stat"><strong>{low.length}</strong><span>Estoque baixo ou zerado</span></div></div>
    <form className="admin-form-grid" onSubmit={async (event) => {
      event.preventDefault();
      if (!product) return;
      setBusy(true);
      try {
        await laborSaveStock({ data: { productId, saleOptionId: saleOptionId || null, quantity: Number(quantity), lowAt: Number(lowAt) } });
        await refresh();
        toast.success("Estoque atualizado.");
      } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível salvar."); }
      finally { setBusy(false); }
    }}>
      <label htmlFor="stock-product">Produto</label><select id="stock-product" value={productId} onChange={(event) => { setProductId(event.target.value); setSaleOptionId(""); setQuantity(""); setLowAt(""); }}>{db.products.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select>
      <label>Variação<select value={saleOptionId} onChange={(event) => { setSaleOptionId(event.target.value); setQuantity(""); setLowAt(""); }}>{variants.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label>
      <label>Quantidade disponível<input type="number" min="0" max="1000000" step="0.001" required value={quantity} placeholder={record ? String(record.quantity) : "Sem controle"} onChange={(event) => setQuantity(event.target.value)} /></label>
      <label>Alerta quando chegar a<input type="number" min="0" max="1000000" step="0.001" required value={lowAt} placeholder={record ? String(record.lowAt) : "0"} onChange={(event) => setLowAt(event.target.value)} /></label>
      <button disabled={busy || !product || quantity === "" || lowAt === ""}>{busy ? "Salvando…" : "Salvar estoque"}</button>
    </form>
    {record && <p>Atual: {record.quantity} · alerta: {record.lowAt} · atualizado em {new Date(record.updatedAt).toLocaleString("pt-BR")}</p>}
    <h3>Itens com alerta</h3>
    {!low.length && <p>Nenhum item controlado está abaixo do limite.</p>}
    {low.map((item) => { const p = db.products.find((product) => product.id === item.productId); return <p key={`${item.productId}:${item.saleOptionId || "base"}`}>{p?.name || "Produto removido"} · {p?.sale_options?.find((option) => option.id === item.saleOptionId)?.label || "Unidade base"} · {item.quantity} restantes</p>; })}
    <details><summary>Últimas movimentações</summary>{(db.stockMovements || []).slice(-30).reverse().map((movement) => <p key={movement.id}>{new Date(movement.at).toLocaleString("pt-BR")} · {db.products.find((p) => p.id === movement.productId)?.name || "Produto"} · {movement.delta > 0 ? "+" : ""}{movement.delta} · {movement.reason}</p>)}</details>
  </section>;
}
