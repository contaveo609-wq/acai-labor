import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Clock, Plus, PauseCircle, Edit2, AlertCircle } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

export const Route = createFileRoute('/admin/horarios')({
  component: AdminHorariosPage,
})

function AdminHorariosPage() {
  const { data: horarios = [], isLoading } = useQuery({
    queryKey: ['admin_horarios'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase.from('store_hours').select('*').order('day_of_week');
        if (error) return [];
        return data;
      } catch (e) {
        return [];
      }
    }
  });

  const diasSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Horários de Funcionamento</h1>
          <p className="text-muted-foreground mt-2">Controle quando sua loja recebe pedidos.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="border-orange-200 text-orange-700 bg-orange-50 hover:bg-orange-100">
            <PauseCircle className="mr-2 h-4 w-4" /> Pausar Loja (Emergência)
          </Button>
          <Button className="bg-red-600 hover:bg-red-700 text-white">
            <Plus className="mr-2 h-4 w-4" /> Novo Turno
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Grade de Horários</CardTitle>
              <CardDescription>A loja abrirá e fechará automaticamente baseada nestes horários.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Forçar Loja Fechada Hoje</span>
              <Switch />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dia da Semana</TableHead>
                <TableHead>Turno</TableHead>
                <TableHead>Abertura</TableHead>
                <TableHead>Fechamento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center">Carregando...</TableCell></TableRow>
              ) : horarios.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-gray-500">
                    <div className="flex flex-col items-center justify-center">
                      <AlertCircle className="h-8 w-8 mb-2 text-gray-300" />
                      Nenhum horário configurado. A loja aparecerá fechada.
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                horarios.map((h: any) => (
                  <TableRow key={h.id}>
                    <TableCell className="font-medium">{diasSemana[h.day_of_week]}</TableCell>
                    <TableCell className="text-gray-600">Padrão</TableCell>
                    <TableCell>{h.open_time}</TableCell>
                    <TableCell>{h.close_time}</TableCell>
                    <TableCell>
                      {h.is_closed ? (
                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Fechado</Badge>
                      ) : (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Aberto</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" className="text-blue-600">
                        <Edit2 className="w-4 h-4" />
                      </Button>
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
