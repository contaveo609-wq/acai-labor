import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Users, Search, Download, Star, AlertCircle } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

export const Route = createFileRoute('/admin/clientes')({
  component: AdminClientesPage,
})

function AdminClientesPage() {
  const { data: clientes = [], isLoading } = useQuery({
    queryKey: ['admin_clientes'],
    queryFn: async () => {
      try {
        const { data: orders, error } = await supabase.from('orders').select('customer_name, customer_phone, total, created_at, status');
        if (error || !orders) return [];

        // Agrupar pedidos por telefone para formar "clientes"
        const clientsMap = new Map();

        orders.forEach(order => {
          if (!order.customer_phone) return;
          const phone = order.customer_phone;
          const current = clientsMap.get(phone) || {
            nome: order.customer_name || 'Sem nome',
            telefone: phone,
            pedidos: 0,
            gastoTotal: 0,
            ultimaCompra: order.created_at,
          };

          current.pedidos += 1;
          if (order.status === 'entregue') {
            current.gastoTotal += Number(order.total || 0);
          }
          if (new Date(order.created_at) > new Date(current.ultimaCompra)) {
            current.ultimaCompra = order.created_at;
          }

          clientsMap.set(phone, current);
        });

        return Array.from(clientsMap.values()).map(c => ({
          ...c,
          status: c.pedidos >= 5 ? 'Vip' : c.pedidos >= 2 ? 'Regular' : 'Novo'
        }));
      } catch (e) {
        return [];
      }
    }
  });

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('pt-BR');

  const totalClientes = clientes.length;
  const clientesVip = clientes.filter(c => c.status === 'Vip').length;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Base de Clientes (CRM)</h1>
          <p className="text-muted-foreground mt-2">Conheça seus clientes, gerados a partir do histórico real de pedidos.</p>
        </div>
        <Button variant="outline" className="border-gray-300" disabled={isLoading || totalClientes === 0}>
          <Download className="mr-2 h-4 w-4" /> Exportar Base
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Clientes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? "..." : totalClientes}</div>
            {totalClientes === 0 && <p className="text-xs text-muted-foreground mt-1">Sem dados suficientes</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes VIP</CardTitle>
            <Star className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? "..." : clientesVip}</div>
            {clientesVip === 0 && <p className="text-xs text-muted-foreground mt-1">Sem dados suficientes</p>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Todos os Clientes</CardTitle>
              <CardDescription>Histórico e segmentação de toda a sua base.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead className="text-center">Nº Pedidos</TableHead>
                <TableHead>Total Gasto</TableHead>
                <TableHead>Última Compra</TableHead>
                <TableHead>Segmento</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center">Carregando CRM...</TableCell></TableRow>
              ) : clientes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-gray-500">
                    <div className="flex flex-col items-center justify-center">
                      <AlertCircle className="h-8 w-8 mb-2 text-gray-300" />
                      Sem dados suficientes. (Nenhum pedido com telefone registrado).
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                clientes.map((cliente: any, idx: number) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">{cliente.nome}</TableCell>
                    <TableCell className="text-gray-600">{cliente.telefone}</TableCell>
                    <TableCell className="text-center">{cliente.pedidos}</TableCell>
                    <TableCell>{formatCurrency(cliente.gastoTotal)}</TableCell>
                    <TableCell className="text-gray-600">{formatDate(cliente.ultimaCompra)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        cliente.status === 'Vip' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                        cliente.status === 'Regular' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                        'bg-gray-100 text-gray-800 border-gray-200'
                      }>
                        {cliente.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" className="text-blue-600">Ver Perfil</Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
