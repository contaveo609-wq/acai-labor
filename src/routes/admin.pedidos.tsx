import { createFileRoute, useNavigate, useSearch } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { Clock, MapPin, User, ChevronRight, XCircle, Search, ExternalLink, PackageCheck } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { fetchOrderWithDetails, updateOrderStatus } from '@/lib/admin-data'
import { formatBRL } from '@/lib/menu'

export const Route = createFileRoute('/admin/pedidos')({
  component: AdminPedidosPage,
})

function AdminPedidosPage() {
  const queryClient = useQueryClient();
  const searchParams = Route.useSearch() as any;
  const navigate = useNavigate({ from: '/admin/pedidos' });
  const [searchTerm, setSearchTerm] = useState('');
  
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(searchParams.id || null);
  const [isModalOpen, setIsModalOpen] = useState(!!searchParams.id);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['admin_active_orders'],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .gte('created_at', today.toISOString())
        .order('created_at', { ascending: true });

      if (error) return [];
      return data;
    }
  });

  const { data: orderDetails, isLoading: isLoadingDetails } = useQuery({
    queryKey: ['admin_order_details', selectedOrderId],
    queryFn: () => selectedOrderId ? fetchOrderWithDetails(selectedOrderId) : null,
    enabled: !!selectedOrderId,
  });

  // Handle cross-tab or global open modal event
  useEffect(() => {
    const handleOpenModal = (e: CustomEvent) => {
      setSelectedOrderId(e.detail);
      setIsModalOpen(true);
    };
    window.addEventListener('open-order-modal' as any, handleOpenModal);
    return () => window.removeEventListener('open-order-modal' as any, handleOpenModal);
  }, []);

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    let notes = '';
    let changedBy = 'admin';
    if (newStatus === 'em_preparacao') notes = 'Pedido confirmado e em preparo.';
    if (newStatus === 'pronto') notes = 'Pedido pronto para entrega.';
    if (newStatus === 'cancelado') notes = 'Pedido cancelado pelo administrador.';
    
    await updateOrderStatus(orderId, newStatus, changedBy, notes);
    queryClient.invalidateQueries({ queryKey: ['admin_active_orders'] });
    if (selectedOrderId === orderId) {
      queryClient.invalidateQueries({ queryKey: ['admin_order_details', orderId] });
    }
  };

  const columns = [
    { title: 'EM ANÁLISE', statuses: ['recebido'], color: 'bg-yellow-500', bgColor: 'bg-yellow-500/10' },
    { title: 'EM PREPARO', statuses: ['confirmado', 'em_preparacao'], color: 'bg-orange-500', bgColor: 'bg-orange-500/10' },
    { title: 'PRONTO', statuses: ['pronto'], color: 'bg-blue-500', bgColor: 'bg-blue-500/10' },
    { title: 'EM ENTREGA', statuses: ['saiu_entrega'], color: 'bg-purple-500', bgColor: 'bg-purple-500/10' },
    { title: 'CONCLUÍDO', statuses: ['entregue'], color: 'bg-green-500', bgColor: 'bg-green-500/10' },
    // Cancelado isn't shown in main flow
  ];

  const filteredOrders = orders.filter((o: any) => 
    o.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    String(o.order_number).includes(searchTerm)
  );

  const formatTime = (dateStr: string) => new Date(dateStr).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="p-4 h-full flex flex-col">
      <div className="mb-4 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Pedidos em Tempo Real</h1>
          <p className="text-muted-foreground text-sm mt-1">Acompanhe e controle o fluxo de pedidos (Em Análise → Concluído).</p>
        </div>
        
        <div className="flex items-center gap-2 max-w-sm w-full relative">
          <Search className="w-4 h-4 absolute left-3 text-muted-foreground" />
          <Input 
            placeholder="Pesquisar pedido ou cliente..." 
            className="pl-9"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 flex overflow-x-auto gap-4 pb-4">
        {columns.map((col) => {
          const columnOrders = filteredOrders.filter((o: any) => col.statuses.includes(o.status));
          
          return (
            <div key={col.title} className={`flex flex-col min-w-[320px] w-[320px] rounded-lg p-3 ${col.bgColor}`}>
              <div className="flex items-center justify-between mb-3 px-1">
                <h3 className="font-semibold text-sm flex items-center gap-2 text-gray-800 dark:text-gray-200">
                  <div className={`w-2.5 h-2.5 rounded-full ${col.color}`} />
                  {col.title}
                </h3>
                <Badge variant="outline" className="font-mono text-xs bg-background">{columnOrders.length}</Badge>
              </div>

              <div className="flex flex-col gap-3 overflow-y-auto pb-2">
                {columnOrders.length === 0 ? (
                  <div className="text-center py-6 text-sm text-gray-500/70 border-2 border-dashed border-gray-300/40 rounded-lg">
                    Vazio
                  </div>
                ) : (
                  columnOrders.map((order: any) => (
                    <Card 
                      key={order.id} 
                      className="shadow-sm border-gray-200/60 hover:shadow-md transition-all cursor-pointer"
                      onClick={() => {
                        setSelectedOrderId(order.id);
                        setIsModalOpen(true);
                      }}
                    >
                      <CardHeader className="p-3 pb-0">
                        <div className="flex justify-between items-start">
                          <CardTitle className="text-sm font-mono font-bold text-primary">
                            #{order.order_number}
                          </CardTitle>
                          <span className="text-xs text-gray-500 flex items-center">
                            <Clock className="w-3 h-3 mr-1" />
                            {formatTime(order.created_at)}
                          </span>
                        </div>
                      </CardHeader>
                      <CardContent className="p-3">
                        <div className="flex items-center gap-2 mb-2 text-sm font-medium">
                          <User className="w-4 h-4 text-gray-500" />
                          <span className="truncate">{order.customer_name}</span>
                        </div>
                        <div className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-400 mb-2">
                          <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
                          <span className="truncate">{order.street}, {order.number} - {order.neighborhood}</span>
                        </div>
                        <div className="font-bold text-gray-900 dark:text-white flex justify-between items-center mt-3 pt-2 border-t">
                          <span>{formatBRL(Number(order.total) || 0)}</span>
                          {order.status === 'pronto' && (
                            <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-200">
                              Aguardando Entregador
                            </Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={isModalOpen} onOpenChange={(open) => {
        setIsModalOpen(open);
        if (!open) {
          setTimeout(() => setSelectedOrderId(null), 300);
          navigate({ search: {} as any });
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span className="text-2xl font-display text-primary">Pedido #{orderDetails?.order_number}</span>
              {orderDetails && (
                <Badge variant="outline" className="text-sm px-3 py-1 bg-muted">
                  {orderDetails.status.toUpperCase()}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              Realizado em {orderDetails ? new Date(orderDetails.created_at).toLocaleString('pt-BR') : ''}
            </DialogDescription>
          </DialogHeader>

          {isLoadingDetails || !orderDetails ? (
            <div className="py-10 text-center">Carregando detalhes do pedido...</div>
          ) : (
            <div className="grid md:grid-cols-2 gap-6 my-4">
              {/* Esquerda: Cliente e Itens */}
              <div className="space-y-6">
                <section className="bg-muted/30 p-4 rounded-xl border">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground" /> 
                    Cliente
                  </h3>
                  <div className="space-y-1 text-sm">
                    <p><span className="text-muted-foreground">Nome:</span> {orderDetails.customer_name}</p>
                    <p><span className="text-muted-foreground">Telefone:</span> {orderDetails.customer_phone}</p>
                  </div>
                </section>

                <section className="bg-muted/30 p-4 rounded-xl border">
                  <h3 className="font-semibold mb-3">Itens do Pedido</h3>
                  <ul className="space-y-3">
                    {orderDetails.order_items?.map((item: any) => (
                      <li key={item.id} className="text-sm border-b pb-2 last:border-0 last:pb-0">
                        <div className="flex justify-between font-medium">
                          <span>{item.quantity}x {item.product_name}</span>
                          <span>{formatBRL(Number(item.line_total))}</span>
                        </div>
                        {item.order_item_addons?.map((addon: any) => (
                          <div key={addon.id} className="text-xs text-muted-foreground pl-4 mt-1">
                            + {addon.quantity}x {addon.name} ({formatBRL(Number(addon.price))})
                          </div>
                        ))}
                        {item.notes && (
                          <div className="text-xs text-amber-600 italic pl-4 mt-1">
                            Obs: {item.notes}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4 pt-3 border-t space-y-1 text-sm">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Subtotal</span>
                      <span>{formatBRL(Number(orderDetails.subtotal))}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Taxa de Entrega</span>
                      <span>{formatBRL(Number(orderDetails.delivery_fee))}</span>
                    </div>
                    <div className="flex justify-between font-bold text-base pt-1">
                      <span>Total</span>
                      <span className="text-primary">{formatBRL(Number(orderDetails.total))}</span>
                    </div>
                    <div className="pt-2">
                      <span className="text-muted-foreground">Pagamento: </span>
                      <span className="font-medium uppercase">{orderDetails.payment_method}</span>
                      {orderDetails.change_for && (
                        <span className="ml-2 text-amber-600">
                          (Troco para {formatBRL(Number(orderDetails.change_for))})
                        </span>
                      )}
                    </div>
                  </div>
                </section>
              </div>

              {/* Direita: Endereço, Histórico e Ações */}
              <div className="space-y-6">
                <section className="bg-muted/30 p-4 rounded-xl border">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground" /> 
                    Entrega
                  </h3>
                  <div className="space-y-1 text-sm">
                    <p>{orderDetails.street}, {orderDetails.number}</p>
                    {orderDetails.complement && <p>{orderDetails.complement}</p>}
                    <p>{orderDetails.neighborhood}</p>
                    <p>{orderDetails.city}</p>
                    {orderDetails.reference && (
                      <p className="mt-2 text-muted-foreground italic">Ref: {orderDetails.reference}</p>
                    )}
                  </div>
                </section>

                <section className="bg-muted/30 p-4 rounded-xl border">
                  <h3 className="font-semibold mb-3">Histórico</h3>
                  <div className="space-y-3 relative before:absolute before:inset-0 before:ml-2 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
                    {orderDetails.order_status_history?.sort((a:any, b:any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map((hist: any, idx: number) => (
                      <div key={hist.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                        <div className="flex items-center justify-center w-4 h-4 rounded-full border border-white bg-slate-300 group-[.is-active]:bg-primary text-slate-500 group-[.is-active]:text-primary-foreground shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2" />
                        <div className="w-[calc(100%-2rem)] md:w-[calc(50%-1.5rem)] text-xs bg-background border p-2 rounded-md shadow-sm">
                          <div className="font-semibold text-slate-900">{hist.status.toUpperCase()}</div>
                          <div className="text-slate-500">{new Date(hist.created_at).toLocaleTimeString('pt-BR')}</div>
                          {hist.notes && <div className="text-muted-foreground mt-1">{hist.notes}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
                
                {/* Ações baseadas no status */}
                <div className="pt-4 flex flex-col gap-3">
                  {orderDetails.status === 'recebido' && (
                    <Button size="lg" className="w-full text-base" onClick={() => handleStatusChange(orderDetails.id, 'em_preparacao')}>
                      CONFIRMAR PEDIDO (EM PREPARO)
                    </Button>
                  )}
                  {orderDetails.status === 'em_preparacao' && (
                    <Button size="lg" className="w-full text-base bg-blue-600 hover:bg-blue-700 text-white" onClick={() => handleStatusChange(orderDetails.id, 'pronto')}>
                      PEDIDO PRONTO
                    </Button>
                  )}
                  {orderDetails.status === 'pronto' && (
                    <div className="flex gap-2">
                      <Button size="lg" className="w-full text-base bg-purple-600 hover:bg-purple-700 text-white" onClick={() => {
                        setIsModalOpen(false);
                        navigate({ to: '/admin/expedicao' });
                      }}>
                        ATRIBUIR ENTREGADOR
                      </Button>
                      <Button size="lg" variant="outline" className="px-3" onClick={() => {
                        setIsModalOpen(false);
                        navigate({ to: '/admin/expedicao' });
                      }} title="Ir para mapa de entregas">
                        <PackageCheck className="w-5 h-5" />
                      </Button>
                    </div>
                  )}
                  {orderDetails.status === 'saiu_entrega' && (
                    <Button size="lg" className="w-full text-base bg-green-600 hover:bg-green-700 text-white" onClick={() => handleStatusChange(orderDetails.id, 'entregue')}>
                      MARCAR COMO CONCLUÍDO
                    </Button>
                  )}
                  
                  {['recebido', 'em_preparacao'].includes(orderDetails.status) && (
                    <Button variant="outline" className="text-red-500 border-red-200 hover:bg-red-50" onClick={() => handleStatusChange(orderDetails.id, 'cancelado')}>
                      RECUSAR / CANCELAR
                    </Button>
                  )}
                </div>

              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
