import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Ticket, Plus, Search, Trash2, Edit2, AlertCircle } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

export const Route = createFileRoute('/admin/cupons')({
  component: AdminCuponsPage,
})

function AdminCuponsPage() {
  const { data: cupons = [], isLoading } = useQuery({
    queryKey: ['admin_cupons'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase.from('coupons').select('*');
        if (error) return [];
        return data;
      } catch (e) {
        return [];
      }
    }
  });

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Cupons de Desconto</h1>
          <p className="text-muted-foreground mt-2">Crie códigos promocionais para seus clientes (Dados reais).</p>
        </div>
        <Button className="bg-red-600 hover:bg-red-700 text-white">
          <Plus className="mr-2 h-4 w-4" /> Novo Cupom
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Cupons Ativos e Inativos</CardTitle>
            </div>
            <div className="flex items-center space-x-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                <Input placeholder="Buscar por código..." className="pl-8 w-64" />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Desconto</TableHead>
                <TableHead>Validade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center">Carregando...</TableCell></TableRow>
              ) : cupons.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-gray-500">
                    <div className="flex flex-col items-center justify-center">
                      <AlertCircle className="h-8 w-8 mb-2 text-gray-300" />
                      Sem dados suficientes (Nenhum cupom cadastrado)
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                cupons.map((cupom: any) => (
                  <TableRow key={cupom.id}>
                    <TableCell className="font-bold text-gray-700">{cupom.code}</TableCell>
                    <TableCell>
                      {cupom.discount_type === 'percentage' ? `${cupom.discount_value}%` : formatCurrency(cupom.discount_value)}
                    </TableCell>
                    <TableCell className="text-gray-600">{new Date(cupom.valid_until).toLocaleDateString('pt-BR')}</TableCell>
                    <TableCell>
                      {cupom.is_active ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Ativo</Badge>
                      ) : (
                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Inativo</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" className="text-blue-600">
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="text-red-600">
                        <Trash2 className="w-4 h-4" />
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
