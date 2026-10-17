import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DollarSign, ShoppingBag, CreditCard, Download, Calendar } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

export const Route = createFileRoute('/admin/relatorios')({
  component: AdminRelatoriosPage,
})

function AdminRelatoriosPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin_reports'],
    queryFn: async () => {
      try {
        const today = new Date();
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

        const { data: orders } = await supabase
          .from("orders")
          .select("total, status, payment_method, delivery_fee")
          .gte("created_at", startOfMonth.toISOString());

        if (!orders || orders.length === 0) {
          return { revenue: 0, count: 0, ticket: 0, deliveryCost: 0, methods: {} };
        }

        const completedOrders = orders.filter(o => o.status === 'entregue');
        const revenue = completedOrders.reduce((acc, curr) => acc + Number(curr.total), 0);
        const deliveryCost = completedOrders.reduce((acc, curr) => acc + Number(curr.delivery_fee || 0), 0);
        const count = completedOrders.length;
        const ticket = count > 0 ? revenue / count : 0;

        const methods = completedOrders.reduce((acc: Record<string, number>, curr) => {
          const method = curr.payment_method || 'Desconhecido';
          acc[method] = (acc[method] || 0) + 1;
          return acc;
        }, {});

        return { revenue, count, ticket, deliveryCost, methods };
      } catch (e) {
        return { revenue: 0, count: 0, ticket: 0, deliveryCost: 0, methods: {} };
      }
    }
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  const getMethodPercentage = (count: number) => {
    if (!stats || stats.count === 0) return 0;
    return Math.round((count / stats.count) * 100);
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Relatórios Financeiros & Vendas</h1>
          <p className="text-muted-foreground mt-2">Métricas e acompanhamento de caixa baseados em dados reais.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="border-gray-300">
            <Calendar className="mr-2 h-4 w-4" /> Este Mês
          </Button>
          <Button variant="outline" className="border-gray-300" disabled={isLoading || stats?.count === 0}>
            <Download className="mr-2 h-4 w-4" /> Exportar (CSV/PDF)
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Faturamento Bruto</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? "..." : formatCurrency(stats?.revenue ?? 0)}</div>
            {stats?.revenue === 0 && <p className="text-xs text-muted-foreground mt-1">Sem dados suficientes</p>}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Pedidos</CardTitle>
            <ShoppingBag className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? "..." : stats?.count ?? 0}</div>
            {stats?.count === 0 && <p className="text-xs text-muted-foreground mt-1">Sem dados suficientes</p>}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
            <CreditCard className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? "..." : formatCurrency(stats?.ticket ?? 0)}</div>
            {stats?.ticket === 0 && <p className="text-xs text-muted-foreground mt-1">Sem dados suficientes</p>}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Custo de Entregas</CardTitle>
            <DollarSign className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? "..." : formatCurrency(stats?.deliveryCost ?? 0)}</div>
            {stats?.deliveryCost === 0 && <p className="text-xs text-muted-foreground mt-1">Sem dados suficientes</p>}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Vendas Diárias</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
             <div className="flex h-[350px] items-center justify-center rounded-md border border-dashed text-muted-foreground">
              Os dados aparecerão aqui após os primeiros pedidos.
            </div>
          </CardContent>
        </Card>
        
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Meios de Pagamento</CardTitle>
            <CardDescription>
              Distribuição do faturamento por forma de pagamento (real).
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
               <div className="flex h-32 items-center justify-center text-muted-foreground">Carregando...</div>
            ) : !stats || Object.keys(stats.methods).length === 0 ? (
               <div className="flex h-32 items-center justify-center text-muted-foreground text-sm border border-dashed rounded">
                 Sem dados suficientes
               </div>
            ) : (
              <div className="space-y-4">
                {Object.entries(stats.methods).map(([method, count]) => {
                  const percent = getMethodPercentage(count);
                  return (
                    <div key={method} className="flex items-center">
                      <div className="w-1/3 text-sm font-medium capitalize">{method.replace('_', ' ')}</div>
                      <div className="w-2/3 flex items-center gap-2">
                        <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500" style={{ width: `${percent}%` }}></div>
                        </div>
                        <span className="text-xs text-gray-500 w-12 text-right">{percent}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
