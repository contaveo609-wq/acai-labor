import { useState } from "react";
import { toast } from "sonner";
import { laborSaveCoupon } from "@/lib/labor.functions";
import { couponSchema } from "@/lib/coupons";
import type { AdminSnapshot } from "@/lib/labor.types";
export function LaborCoupons({ db, refresh }: { db: AdminSnapshot; refresh: () => Promise<void> }) {
  const initial = couponSchema.parse({
    code: "NOVOCUPOM",
    percent: 10,
    min_total: 0,
    is_active: true,
  });
  const [coupon, setCoupon] = useState(initial),
    [busy, setBusy] = useState(false);
  return (
    <details className="support-settings mb-5">
      <summary>Gerenciar cupons</summary>
      <label>
        Cupom existente
        <select
          onChange={(e) => {
            const c = db.coupons.find((c) => c.code === e.target.value);
            setCoupon(c ? couponSchema.parse(c) : initial);
          }}
        >
          <option value="">Novo cupom</option>
          {db.coupons.map((c) => (
            <option key={c.code}>{c.code}</option>
          ))}
        </select>
      </label>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await laborSaveCoupon({ data: coupon });
            await refresh();
            toast.success("Cupom salvo.");
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Falha ao salvar");
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Código
          <input
            value={coupon.code}
            onChange={(e) => setCoupon({ ...coupon, code: e.target.value.toUpperCase() })}
          />
        </label>
        <label>
          Desconto
          <select
            value={coupon.kind}
            onChange={(e) => setCoupon({ ...coupon, kind: e.target.value as typeof coupon.kind })}
          >
            <option value="percent">Percentual</option>
            <option value="fixed">Valor fixo</option>
            <option value="shipping">Frete grátis</option>
          </select>
        </label>
        {coupon.kind !== "shipping" && (
          <label>
            {coupon.kind === "percent" ? "Percentual (%)" : "Valor (R$)"}
            <input
              type="number"
              min="0"
              step="0.01"
              value={coupon.kind === "percent" ? coupon.percent : coupon.amount}
              onChange={(e) =>
                setCoupon({
                  ...coupon,
                  [coupon.kind === "percent" ? "percent" : "amount"]: Number(e.target.value),
                })
              }
            />
          </label>
        )}
        <label>
          Compra mínima (R$)
          <input
            type="number"
            min="0"
            value={coupon.min_total}
            onChange={(e) => setCoupon({ ...coupon, min_total: Number(e.target.value) })}
          />
        </label>
        <label>
          Validade
          <input
            type="datetime-local"
            value={
              coupon.expires_at
                ? new Date(Date.parse(coupon.expires_at) - new Date().getTimezoneOffset() * 60000)
                    .toISOString()
                    .slice(0, 16)
                : ""
            }
            onChange={(e) =>
              setCoupon({
                ...coupon,
                expires_at: e.target.value ? new Date(e.target.value).toISOString() : null,
              })
            }
          />
        </label>
        <label>
          Limite total (0: sem limite)
          <input
            type="number"
            min="0"
            value={coupon.max_uses}
            onChange={(e) => setCoupon({ ...coupon, max_uses: Number(e.target.value) })}
          />
        </label>
        <label>
          Limite por sessão de cliente (0: sem limite)
          <input
            type="number"
            min="0"
            value={coupon.per_customer}
            onChange={(e) => setCoupon({ ...coupon, per_customer: Number(e.target.value) })}
          />
        </label>
        <label>
          Histórico exigido nesta sessão
          <select
            value={coupon.eligibility}
            onChange={(e) =>
              setCoupon({ ...coupon, eligibility: e.target.value as typeof coupon.eligibility })
            }
          >
            <option value="all">Todos</option>
            <option value="first">Primeiro pedido</option>
            <option value="recurring">Dois ou mais pedidos</option>
            <option value="inactive">Sem pedido recente</option>
          </select>
        </label>
        <label>
          Dias sem compra para inatividade
          <input
            type="number"
            min="1"
            value={coupon.inactive_days}
            onChange={(e) => setCoupon({ ...coupon, inactive_days: Number(e.target.value) })}
          />
        </label>
        <label>
          Produtos elegíveis (vazio: todos)
          <select
            multiple
            value={coupon.product_ids}
            onChange={(e) =>
              setCoupon({
                ...coupon,
                product_ids: Array.from(e.target.selectedOptions, (o) => o.value),
              })
            }
          >
            {db.products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={coupon.is_active}
            onChange={(e) => setCoupon({ ...coupon, is_active: e.target.checked })}
          />{" "}
          Ativo
        </label>
        <button disabled={busy}>Salvar cupom</button>
      </form>
    </details>
  );
}
