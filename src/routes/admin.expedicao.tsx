import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PackageCheck, Bike, Clock, MapPin, User, ChevronRight, MessageSquare, CheckCircle2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { assignDriverToOrder, completeDelivery, fetchOrderWithDetails, fetchWhatsAppProviderConfig } from '@/lib/admin-data'
import { formatBRL } from '@/lib/menu'
import { getWhatsAppDirectLink, whatsappTemplates } from '@/lib/whatsapp-provider'

export const Route = createFileRoute('/admin/expedicao')({
  component: AdminExpedicaoPage,
})

function AdminExpedicaoPage() {
  const queryClient = useQueryClient();
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [isDriverModalOpen, setIsDriverModalOpen] = useState(false);
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);

  const { data: orders = [] } = useQuery({
    queryKey: ['admin_expedicao_orders'],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from('orders')
        .select('*, driver_assignments(driver_id, delivery_drivers(name, whatsapp, phone))')
        .in('status', ['pronto', 'saiu_entrega'])
        .gte('created_at', today.toISOString())
        .order('created_at', { ascending: true });

      if (error) return [];
      return data;
    },
    refetchInterval: 15000,
  });

  const { data: drivers = [] } = useQuery({
    queryKey: ['admin_available_drivers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('delivery_drivers')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) return [];
      return data;
    },
  });

  const { data: orderDetails } = useQuery({
    queryKey: ['admin_order_details', selectedOrderId],
    queryFn: () => selectedOrderId ? fetchOrderWithDetails(selectedOrderId) : null,
    enabled: !!selectedOrderId,
  });

  const handleOpenAssignModal = (orderId: string) => {
    setSelectedOrderId(orderId);
    setSelectedDriverId(null);
    setIsDriverModalOpen(true);
  };

  const handleAssignDriver = async () => {
    if (!selectedOrderId || !selectedDriverId) return;
    
    const success = await assignDriverToOrder(selectedOrderId, selectedDriverId);
    if (success) {
      setIsDriverModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['admin_expedicao_orders'] });
      queryClient.invalidateQueries({ queryKey: ['admin_available_drivers'] });
      queryClient.invalidateQueries({ queryKey: ['admin_active_orders'] });
    }
  };

  const handleCompleteDelivery = async (orderId: string, driverId: string) => {
    const success = await completeDelivery(orderId, driverId);
    if (success) {
      queryClient.invalidateQueries({ queryKey: ['admin_expedicao_orders'] });
      queryClient.invalidateQueries({ queryKey: ['admin_available_drivers'] });
    }
  };

  const prontos = orders.filter((o: any) => o.status === 'pronto');
  const emEntrega = orders.filter((o: any) => o.status === 'saiu_entrega');
  const availableDrivers = drivers.filter((d: any) => d.status === 'disponivel');

  const getDriverLink = (driverData: any, orderData: any) => {
    const num = driverData?.whatsapp || driverData?.phone;
    if (!num) return '#';
    const msg = whatsappTemplates.driverAssignment(
      orderData.order_number, 
      orderData.customer_name, 
      `${orderData.street}, ${orderData.number} - ${orderData.neighborhood}`,
      orderData.reference
    );
    return getWhatsAppDirectLink(num, msg);
  };

  const formatTime = (dateStr: string) => new Date(dateStr).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="p-4 md:p-6 h-full flex flex-col max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-3">
          <PackageCheck className="w-8 h-8 text-primary" />
          Expedição
        </h1>
        <p className="text-muted-foreground mt-1">Gerencie atribuições e acompanhe os entregadores em rota.</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8 flex-1">
        {/* Coluna PRONTOS */}
        <div className="bg-blue-50/50 dark:bg-blue-900/10 rounded-2xl p-4 border border-blue-100 dark:border-blue-800/30">
          <div className="flex items-center justify-between mb-4 px-2">
            <h2 className="text-lg font-bold text-blue-800 dark:text-blue-300 flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-blue-500 animate-pulse"></span>
              Prontos para Entrega
            </h2>
            <Badge className="bg-blue-600">{prontos.length}</Badge>
          </div>

          <div className="space-y-4">
            {prontos.length === 0 ? (
              <div className="text-center py-12 text-blue-400/70 border-2 border-dashed border-blue-200/50 rounded-xl">
                Nenhum pedido aguardando entregador.
              </div>
            ) : (
              prontos.map((order: any) => (
                <Card key={order.id} className="border-blue-200/60 shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <span className="font-display font-bold text-xl text-primary">#{order.order_number}</span>
                        <span className="text-sm text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {formatTime(order.created_at)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <User className="w-4 h-4 text-muted-foreground" />
                        {order.customer_name}
                      </div>
                      <div className="flex items-start gap-2 text-sm text-muted-foreground">
                        <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
                        <span>{order.street}, {order.number} - {order.neighborhood}</span>
                      </div>
                    </div>
                    
                    <Button size="lg" className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white" onClick={() => handleOpenAssignModal(order.id)}>
                      Atribuir Entregador
                    </Button>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>

        {/* Coluna EM ENTREGA */}
        <div className="bg-purple-50/50 dark:bg-purple-900/10 rounded-2xl p-4 border border-purple-100 dark:border-purple-800/30">
          <div className="flex items-center justify-between mb-4 px-2">
            <h2 className="text-lg font-bold text-purple-800 dark:text-purple-300 flex items-center gap-2">
              <Bike className="w-5 h-5" />
              Em Rota de Entrega
            </h2>
            <Badge className="bg-purple-600">{emEntrega.length}</Badge>
          </div>

          <div className="space-y-4">
            {emEntrega.length === 0 ? (
              <div className="text-center py-12 text-purple-400/70 border-2 border-dashed border-purple-200/50 rounded-xl">
                Nenhuma entrega em andamento.
              </div>
            ) : (
              emEntrega.map((order: any) => {
                const driver = order.driver_assignments?.[0]?.delivery_drivers;
                const driverId = order.driver_assignments?.[0]?.driver_id;
                
                return (
                  <Card key={order.id} className="border-purple-200/60 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-purple-500"></div>
                    <CardContent className="p-4 pl-5">
                      <div className="flex justify-between items-start mb-3">
                        <span className="font-display font-bold text-lg text-purple-700 dark:text-purple-400">#{order.order_number}</span>
                        <div className="flex items-center gap-1.5 bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300 px-2.5 py-1 rounded-full text-xs font-semibold">
                          <Bike className="w-3.5 h-3.5" />
                          {driver?.name || 'Desconhecido'}
                        </div>
                      </div>
                      
                      <div className="space-y-1 mb-4 text-sm">
                        <p className="font-medium">{order.customer_name}</p>
                        <p className="text-muted-foreground">{order.street}, {order.number} - {order.neighborhood}</p>
                      </div>

                      <div className="flex gap-2 border-t pt-3">
                        {driver && (
                          <Button variant="outline" size="sm" className="flex-1 bg-green-50 text-green-700 border-green-200 hover:bg-green-100 hover:text-green-800" asChild>
                            <a href={getDriverLink(driver, order)} target="_blank" rel="noreferrer">
                              <MessageSquare className="w-4 h-4 mr-1.5" />
                              WhatsApp
                            </a>
                          </Button>
                        )}
                        <Button size="sm" className="flex-1 bg-purple-600 hover:bg-purple-700 text-white" onClick={() => handleCompleteDelivery(order.id, driverId)}>
                          <CheckCircle2 className="w-4 h-4 mr-1.5" />
                          Concluir
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </div>
      </div>

      <Dialog open={isDriverModalOpen} onOpenChange={setIsDriverModalOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Atribuir Entregador</DialogTitle>
            <DialogDescription>
              Selecione o entregador que fará a entrega do pedido #{orderDetails?.order_number}.
            </DialogDescription>
          </DialogHeader>

          {orderDetails && (
            <div className="bg-muted/40 p-3 rounded-lg text-sm mb-2 border">
              <p><strong>Destino:</strong> {orderDetails.street}, {orderDetails.number} - {orderDetails.neighborhood}</p>
              <p><strong>Cliente:</strong> {orderDetails.customer_name}</p>
              <p><strong>Valor a cobrar:</strong> {orderDetails.payment_method === 'dinheiro' || orderDetails.payment_method === 'cartao' ? formatBRL(orderDetails.total) : 'Pago via Pix'}</p>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 py-4">
            {availableDrivers.length === 0 ? (
              <div className="col-span-full py-8 text-center text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
                Nenhum entregador disponível no momento.
              </div>
            ) : (
              availableDrivers.map((driver: any) => (
                <button
                  key={driver.id}
                  onClick={() => setSelectedDriverId(driver.id)}
                  className={`flex flex-col items-center p-4 rounded-xl border-2 transition-all ${
                    selectedDriverId === driver.id 
                      ? 'border-primary bg-primary/5 shadow-sm scale-[1.02]' 
                      : 'border-border hover:border-primary/40 hover:bg-muted/50'
                  }`}
                >
                  <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-800 mb-3 flex items-center justify-center overflow-hidden">
                    {driver.photo_url ? (
                      <img src={driver.photo_url} alt={driver.name} className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-6 h-6 text-slate-400" />
                    )}
                  </div>
                  <span className="font-semibold text-sm text-center line-clamp-1">{driver.nickname || driver.name.split(' ')[0]}</span>
                  <span className="text-xs text-muted-foreground">{driver.vehicle || 'Moto'}</span>
                </button>
              ))
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsDriverModalOpen(false)}>Cancelar</Button>
            <Button 
              onClick={handleAssignDriver} 
              disabled={!selectedDriverId}
              className="bg-primary text-primary-foreground font-semibold"
            >
              Confirmar Envio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
