import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Star, MessageSquareQuote, TrendingUp, AlertCircle } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export const Route = createFileRoute('/admin/satisfacao')({
  component: AdminSatisfacaoPage,
})

function AdminSatisfacaoPage() {
  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ['admin_reviews'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase.from('reviews').select('*').order('created_at', { ascending: false });
        if (error) return [];
        return data;
      } catch (e) {
        return [];
      }
    }
  });

  const totalReviews = reviews.length;
  const averageRating = totalReviews > 0 ? (reviews.reduce((acc: number, curr: any) => acc + curr.rating, 0) / totalReviews).toFixed(1) : 0;
  
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Pesquisa de Satisfação & Avaliações</h1>
          <p className="text-muted-foreground mt-2">Acompanhe a opinião dos clientes sobre os pedidos e o atendimento.</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Nota Média (Geral)</CardTitle>
            <Star className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold flex items-center gap-2">
              {isLoading ? "..." : averageRating} <span className="text-base font-normal text-muted-foreground">/ 5.0</span>
            </div>
            {totalReviews === 0 && <p className="text-xs text-muted-foreground mt-2">Sem avaliações ainda.</p>}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Avaliações</CardTitle>
            <MessageSquareQuote className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">{isLoading ? "..." : totalReviews}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">NPS Estimado</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-gray-300">--</div>
            <p className="text-xs text-muted-foreground mt-2">Dados insuficientes</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Últimas Avaliações</CardTitle>
          <CardDescription>Feedback real deixado pelos clientes.</CardDescription>
        </CardHeader>
        <CardContent>
           <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Pedido</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Nota</TableHead>
                <TableHead>Comentário</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center">Carregando...</TableCell></TableRow>
              ) : reviews.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-gray-500">
                    <div className="flex flex-col items-center justify-center">
                      <AlertCircle className="h-8 w-8 mb-2 text-gray-300" />
                      Sem avaliações ainda.
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                reviews.map((rev: any) => (
                  <TableRow key={rev.id}>
                    <TableCell className="text-gray-500">{new Date(rev.created_at).toLocaleDateString('pt-BR')}</TableCell>
                    <TableCell className="font-mono text-sm text-gray-500">#{rev.order_id?.slice(0,8).toUpperCase() || 'N/A'}</TableCell>
                    <TableCell className="font-medium">{rev.customer_name || 'Anônimo'}</TableCell>
                    <TableCell>
                      <div className="flex">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} className={`w-4 h-4 ${i < rev.rating ? 'text-yellow-500 fill-current' : 'text-gray-300'}`} />
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-700 italic">"{rev.comment || 'Sem comentário'}"</TableCell>
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
