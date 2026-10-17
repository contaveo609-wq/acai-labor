import { createFileRoute } from "@tanstack/react-router";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DollarSign, ShoppingBag, Users, Activity } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const { data: stats } = useQuery({
    queryKey: ["admin_dashboard_stats"],
    queryFn: async () => {
      // In a real app, this would be an RPC call or complex aggregation.
      // For now, we fetch a few counts gracefully.
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [{ count: ordersCount }, { data: orders }] = await Promise.all([
        supabase
          .from("orders")
          .select("*", { count: "exact", head: true })
          .gte("created_at", today.toISOString()),
        supabase
          .from("orders")
          .select("total")
          .gte("created_at", today.toISOString())
          .eq("status", "entregue"),
      ]);

      const revenue = (orders ?? []).reduce((acc, curr) => acc + Number(curr.total), 0);

      return {
        orders: ordersCount ?? 0,
        revenue,
        ticket: ordersCount ? revenue / ordersCount : 0,
      };
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">Visão geral do seu negócio hoje.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Faturamento (Hoje)</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                stats?.revenue ?? 0,
              )}
            </div>
            {stats?.revenue === 0 && (
              <p className="text-xs text-muted-foreground mt-1">Sem dados suficientes</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Pedidos (Hoje)</CardTitle>
            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+{stats?.orders ?? 0}</div>
            {stats?.orders === 0 && (
              <p className="text-xs text-muted-foreground mt-1">Sem dados suficientes</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                stats?.ticket ?? 0,
              )}
            </div>
            {stats?.ticket === 0 && (
              <p className="text-xs text-muted-foreground mt-1">Sem dados suficientes</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Novos Clientes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+0</div>
            <p className="text-xs text-muted-foreground mt-1">Sem dados suficientes</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Visão Geral</CardTitle>
            <CardDescription>Sem dados suficientes para gerar o gráfico.</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="flex h-[350px] items-center justify-center rounded-md border border-dashed text-muted-foreground">
              Gráfico de Faturamento
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Top Produtos</CardTitle>
            <CardDescription>Sem dados suficientes para gerar o ranking.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex h-[350px] items-center justify-center rounded-md border border-dashed text-muted-foreground">
              Ranking de Vendas
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
