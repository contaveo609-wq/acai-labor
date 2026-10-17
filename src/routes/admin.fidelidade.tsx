import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Gift, Coins, AlertCircle } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

export const Route = createFileRoute('/admin/fidelidade')({
  component: AdminFidelidadePage,
})

function AdminFidelidadePage() {
  const { data: config, isLoading } = useQuery({
    queryKey: ['admin_loyalty_config'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase.from('loyalty_config').select('*').single();
        if (error && error.code !== 'PGRST116') throw error;
        return data || null;
      } catch (e) {
        return null;
      }
    }
  });

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Programa de Fidelidade</h1>
          <p className="text-muted-foreground mt-2">Recompense seus melhores clientes com pontos e cashback.</p>
        </div>
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-gray-500">Carregando configurações...</div>
      ) : !config ? (
        <Card className="border-dashed border-2 bg-gray-50/50">
           <CardContent className="flex flex-col items-center justify-center h-64 text-gray-500">
              <AlertCircle className="w-12 h-12 mb-4 text-gray-300" />
              <h3 className="text-lg font-semibold text-gray-700">Não configurado</h3>
              <p className="text-sm mt-2 mb-4">Nenhuma regra de fidelidade ativa no momento.</p>
              <Button>Configurar Programa de Fidelidade</Button>
           </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="border-green-100">
            <CardHeader className="bg-green-50/50 border-b border-green-50 pb-4">
              <div className="flex justify-between items-center">
                <CardTitle className="flex items-center gap-2 text-green-900">
                  <Gift className="h-5 w-5 text-green-600" /> Status do Programa
                </CardTitle>
                <Switch checked={config.is_active} />
              </div>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-semibold text-gray-900">Conversão de Pontos</label>
                  <p className="text-xs text-gray-500 mb-2">Quantos reais equivalem a 1 ponto?</p>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">R$</span>
                    <Input defaultValue={config.points_per_real || 1} type="number" className="w-24" />
                    <span className="text-sm">= 1 Ponto</span>
                  </div>
                </div>
                
                <div>
                  <label className="text-sm font-semibold text-gray-900">Cashback / Resgate</label>
                  <p className="text-xs text-gray-500 mb-2">Quantos pontos são necessários para R$ 1,00 de desconto?</p>
                  <div className="flex items-center gap-2">
                    <Input defaultValue={config.points_to_redeem || 10} type="number" className="w-24" />
                    <span className="text-sm">Pontos = R$ 1,00</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t mt-6">
                <Button className="w-full bg-green-600 hover:bg-green-700 text-white">
                  Salvar Regras
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Coins className="h-5 w-5 text-yellow-600" /> Resumo do Passivo
              </CardTitle>
              <CardDescription>Pontos distribuídos aos clientes que ainda não foram resgatados.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="text-4xl font-bold text-gray-900 mb-2">0</div>
              <p className="text-sm text-gray-500 uppercase tracking-widest font-semibold">Pontos Ativos</p>
              
              <div className="mt-8 text-center text-sm text-gray-400 border border-dashed p-4 rounded w-full">
                Os dados aparecerão aqui após os primeiros pedidos computados.
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
