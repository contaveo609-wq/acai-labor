import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, CheckCircle2, XCircle, Search, Edit, MessageSquare, UserCircle, Bike } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import type { DeliveryDriver } from '@/lib/admin-types'
import { getWhatsAppDirectLink } from '@/lib/whatsapp-provider'
import { toast } from 'sonner'

export const Route = createFileRoute('/admin/entregadores')({
  component: AdminEntregadoresPage,
})

function AdminEntregadoresPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Partial<DeliveryDriver> | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: drivers = [], isLoading } = useQuery({
    queryKey: ['admin_drivers'],
    queryFn: async () => {
      const { data, error } = await supabase.from('delivery_drivers').select('*').order('name');
      if (error) return [];
      return data as DeliveryDriver[];
    }
  });

  const { data: activeDeliveries = [] } = useQuery({
    queryKey: ['admin_active_deliveries_drivers_page'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('driver_assignments')
        .select('driver_id, orders(*)')
        .is('completed_at', null);
      if (error) return [];
      return data;
    }
  });

  const handleSaveDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDriver?.name || !editingDriver.phone) {
      toast.error("Informe o nome e o telefone do entregador.");
      return;
    }
    setIsSubmitting(true);
    
    try {
      const payload = {
        name: editingDriver.name,
        nickname: editingDriver?.nickname || null,
        phone: editingDriver.phone,
        whatsapp: editingDriver?.whatsapp || null,
        vehicle: editingDriver?.vehicle || null,
        plate: editingDriver?.plate || null,
        status: editingDriver?.status || 'disponivel',
        is_active: editingDriver?.is_active ?? true,
      };

      if (editingDriver?.id) {
        // Update
        const { error } = await supabase.from('delivery_drivers').update(payload).eq('id', editingDriver.id);
        if (error) throw error;
        toast.success("Entregador atualizado com sucesso!");
      } else {
        // Insert
        const { error } = await supabase.from('delivery_drivers').insert(payload);
        if (error) throw error;
        toast.success("Entregador cadastrado com sucesso!");
      }

      setIsModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['admin_drivers'] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar entregador");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    const { error } = await supabase.from('delivery_drivers').update({ is_active: !currentActive }).eq('id', id);
    if (!error) {
      queryClient.invalidateQueries({ queryKey: ['admin_drivers'] });
      toast.success(`Entregador ${!currentActive ? 'ativado' : 'desativado'} com sucesso!`);
    }
  };

  const openNewDriverModal = () => {
    setEditingDriver({
      name: '', nickname: '', phone: '', whatsapp: '', vehicle: '', plate: '', status: 'disponivel', is_active: true
    });
    setIsModalOpen(true);
  };

  const openEditModal = (driver: DeliveryDriver) => {
    setEditingDriver(driver);
    setIsModalOpen(true);
  };

  const online = drivers.filter(d => (d.status === 'disponivel' || d.status === 'em_entrega') && d.is_active).length;
  const inDelivery = drivers.filter(d => d.status === 'em_entrega' && d.is_active).length;
  const available = drivers.filter(d => d.status === 'disponivel' && d.is_active).length;
  const inactive = drivers.filter(d => !d.is_active).length;

  const filteredDrivers = drivers.filter(d => 
    d.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (d.nickname && d.nickname.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto h-full flex flex-col">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-3">
            <Bike className="w-8 h-8 text-primary" />
            Entregadores
          </h1>
          <p className="text-muted-foreground mt-2">Gerencie sua frota, perfil de entregadores e status atual.</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90 text-primary-foreground shrink-0" onClick={openNewDriverModal}>
          <Plus className="mr-2 h-4 w-4" /> Novo Entregador
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-green-50/50 border-green-200">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-medium text-green-800">Online</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-3xl font-display text-green-700">{online}</div>
          </CardContent>
        </Card>
        <Card className="bg-blue-50/50 border-blue-200">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-medium text-blue-800">Em Entrega</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-3xl font-display text-blue-700">{inDelivery}</div>
          </CardContent>
        </Card>
        <Card className="bg-yellow-50/50 border-yellow-200">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-medium text-yellow-800">Disponíveis</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-3xl font-display text-yellow-700">{available}</div>
          </CardContent>
        </Card>
        <Card className="bg-slate-50/50 border-slate-200">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Inativos</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-3xl font-display text-slate-500">{inactive}</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex-1 bg-card rounded-2xl border p-1">
        <div className="p-4 border-b flex flex-col sm:flex-row justify-between items-center gap-4">
          <h2 className="text-lg font-bold">Perfil dos Entregadores</h2>
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
            <Input 
              placeholder="Pesquisar entregador..." 
              className="pl-9"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {isLoading ? (
            <div className="col-span-full py-10 text-center text-muted-foreground">Carregando entregadores...</div>
          ) : filteredDrivers.length === 0 ? (
            <div className="col-span-full py-10 text-center text-muted-foreground bg-muted/20 border border-dashed rounded-xl">
              Nenhum entregador encontrado.
            </div>
          ) : (
            filteredDrivers.map(driver => {
              const currentDelivery = activeDeliveries.find((d: any) => d.driver_id === driver.id);
              
              return (
                <Card key={driver.id} className={`overflow-hidden transition-all ${!driver.is_active ? 'opacity-60 bg-muted/30' : 'hover:shadow-md'}`}>
                  <div className={`h-1.5 w-full ${
                    !driver.is_active ? 'bg-slate-300' : 
                    driver.status === 'disponivel' ? 'bg-green-500' : 
                    driver.status === 'em_entrega' ? 'bg-blue-500' : 'bg-yellow-500'
                  }`}></div>
                  
                  <CardContent className="p-5 flex flex-col h-full">
                    <div className="flex items-start gap-4 mb-4">
                      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                        {driver.photo_url ? (
                          <img src={driver.photo_url} alt={driver.name} className="w-full h-full object-cover rounded-full" />
                        ) : (
                          <UserCircle className="w-7 h-7 text-slate-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-lg truncate" title={driver.name}>
                          {driver.nickname || driver.name.split(' ')[0]}
                        </h3>
                        <p className="text-xs text-muted-foreground truncate">{driver.name}</p>
                      </div>
                    </div>

                    <div className="space-y-2 text-sm mb-4 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Status:</span>
                        {!driver.is_active ? (
                          <Badge variant="outline" className="text-slate-500">Inativo</Badge>
                        ) : driver.status === 'disponivel' ? (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Disponível</Badge>
                        ) : driver.status === 'em_entrega' ? (
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Em Entrega</Badge>
                        ) : (
                          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Indisponível</Badge>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Telefone:</span>
                        <span className="font-medium">{driver.phone}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Veículo:</span>
                        <span className="font-medium">{driver.vehicle || '—'} {driver.plate ? `(${driver.plate})` : ''}</span>
                      </div>
                      
                      {currentDelivery && driver.status === 'em_entrega' && (
                        <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-100 dark:border-blue-800/30">
                          <p className="text-xs font-semibold text-blue-800 dark:text-blue-300 flex items-center gap-1.5 mb-1">
                            <Bike className="w-3.5 h-3.5" /> Entrega Atual
                          </p>
                          <p className="text-xs truncate">Pedido #{currentDelivery.orders?.order_number}</p>
                          <p className="text-xs text-muted-foreground truncate">{currentDelivery.orders?.neighborhood}</p>
                        </div>
                      )}
                    </div>

                    <div className="pt-3 border-t grid grid-cols-2 gap-2 mt-auto">
                      <Button variant="outline" size="sm" className="w-full" onClick={() => openEditModal(driver)}>
                        <Edit className="w-3.5 h-3.5 mr-1.5" /> Editar
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full bg-green-50 hover:bg-green-100 text-green-700 border-green-200 hover:text-green-800"
                        asChild
                      >
                        <a href={getWhatsAppDirectLink(driver.whatsapp || driver.phone, "Olá! Mensagem da Skina do Frango & Assados.")} target="_blank" rel="noreferrer">
                          <MessageSquare className="w-3.5 h-3.5 mr-1.5" /> WhatsApp
                        </a>
                      </Button>
                      <Button 
                        variant={driver.is_active ? "ghost" : "secondary"} 
                        size="sm" 
                        className={`col-span-2 ${driver.is_active ? 'text-red-600 hover:text-red-700 hover:bg-red-50' : 'text-green-600 hover:text-green-700 hover:bg-green-50'}`}
                        onClick={() => handleToggleActive(driver.id, driver.is_active)}
                      >
                        {driver.is_active ? (
                          <><XCircle className="w-3.5 h-3.5 mr-1.5" /> Desativar Entregador</>
                        ) : (
                          <><CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Ativar Entregador</>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })
          )}
        </div>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingDriver?.id ? 'Editar Entregador' : 'Cadastrar Entregador'}</DialogTitle>
            <DialogDescription>
              Preencha os dados do entregador. O WhatsApp será usado para enviar pedidos.
            </DialogDescription>
          </DialogHeader>
          
          <form id="driverForm" onSubmit={handleSaveDriver} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome Completo *</Label>
              <Input 
                id="name" 
                value={editingDriver?.name || ''} 
                onChange={e => setEditingDriver(prev => ({...prev, name: e.target.value}))} 
                required 
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nickname">Apelido</Label>
                <Input 
                  id="nickname" 
                  value={editingDriver?.nickname || ''} 
                  onChange={e => setEditingDriver(prev => ({...prev, nickname: e.target.value}))} 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone (Contato) *</Label>
                <Input 
                  id="phone" 
                  value={editingDriver?.phone || ''} 
                  onChange={e => setEditingDriver(prev => ({...prev, phone: e.target.value}))} 
                  required 
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="whatsapp">WhatsApp Operacional (com DDD)</Label>
              <Input 
                id="whatsapp" 
                placeholder="Ex: 66999999999"
                value={editingDriver?.whatsapp || ''} 
                onChange={e => setEditingDriver(prev => ({...prev, whatsapp: e.target.value}))} 
              />
              <p className="text-xs text-muted-foreground">
                Se vazio, o sistema usará o telefone de contato para enviar mensagens do WhatsApp.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="vehicle">Veículo</Label>
                <Input 
                  id="vehicle" 
                  placeholder="Ex: Moto Honda"
                  value={editingDriver?.vehicle || ''} 
                  onChange={e => setEditingDriver(prev => ({...prev, vehicle: e.target.value}))} 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="plate">Placa</Label>
                <Input 
                  id="plate" 
                  placeholder="Ex: ABC-1234"
                  value={editingDriver?.plate || ''} 
                  onChange={e => setEditingDriver(prev => ({...prev, plate: e.target.value}))} 
                />
              </div>
            </div>
          </form>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
            <Button type="submit" form="driverForm" disabled={isSubmitting}>
              {isSubmitting ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
