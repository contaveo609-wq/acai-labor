import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/menu";

export function AdminFinance() {
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["admin-finance"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, status, total, created_at, payment_method, order_items(product_name, quantity, line_total)")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data;
    },
  });

  const stats = useMemo(() => {
    const valid = orders.filter((o) => o.status !== "cancelado");
    const revenue = valid.reduce((sum, o) => sum + Number(o.total), 0);
    const count = valid.length;
    const ticket = count ? revenue / count : 0;

    const byDay = new Map<string, number>();
    for (const order of valid) {
      const day = new Date(order.created_at as string).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
      });
      byDay.set(day, (byDay.get(day) ?? 0) + Number(order.total));
    }
    const chart = [...byDay.entries()].reverse().slice(-14).map(([day, total]) => ({ day, total }));

    const byProduct = new Map<string, { quantity: number; total: number }>();
    for (const order of valid) {
      for (const item of order.order_items ?? []) {
        const entry = byProduct.get(item.product_name as string) ?? { quantity: 0, total: 0 };
        entry.quantity += Number(item.quantity);
        entry.total += Number(item.line_total);
        byProduct.set(item.product_name as string, entry);
      }
    }
    const top = [...byProduct.entries()].sort((a, b) => b[1].quantity - a[1].quantity).slice(0, 8);

    const today = new Date().toDateString();
    const todayRevenue = valid
      .filter((o) => new Date(o.created_at as string).toDateString() === today)
      .reduce((sum, o) => sum + Number(o.total), 0);

    return { revenue, count, ticket, chart, top, todayRevenue, cancelled: orders.length - valid.length };
  }, [orders]);

  if (isLoading) return <p className="text-muted-foreground">Carregando dados financeiros...</p>;

  if (orders.length === 0) {
    return (
      <p className="rounded-2xl border border-border bg-card p-6 text-center text-muted-foreground">
        Ainda não há pedidos registrados. Os indicadores aparecem aqui assim que o primeiro pedido for feito.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Faturamento total" value={formatBRL(stats.revenue)} />
        <Stat label="Faturamento hoje" value={formatBRL(stats.todayRevenue)} />
        <Stat label="Pedidos válidos" value={String(stats.count)} />
        <Stat label="Ticket médio" value={formatBRL(stats.ticket)} />
      </div>

      <section className="rounded-2xl border border-border bg-card p-4">
        <h3 className="font-display text-2xl">Faturamento por dia</h3>
        <div className="mt-3 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.chart}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="day" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip formatter={(value: number) => formatBRL(Number(value))} />
              <Bar dataKey="total" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <h3 className="font-display text-2xl">Produtos mais vendidos</h3>
        <ul className="mt-2 divide-y divide-border text-sm">
          {stats.top.map(([name, data]) => (
            <li key={name} className="flex justify-between py-2">
              <span>
                {data.quantity}x {name}
              </span>
              <span className="font-semibold text-primary">{formatBRL(data.total)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-3xl text-primary">{value}</p>
    </div>
  );
}
