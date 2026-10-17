import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Edit2, PackageX, PackageCheck, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { Badge } from '@/components/ui/badge'

export const Route = createFileRoute('/admin/produtos')({
  component: AdminProdutosPage,
})

function AdminProdutosPage() {
  const queryClient = useQueryClient();

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['admin_products'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase.from('products').select(`*, category:categories(name), product_images(url, is_primary, sort_order)`).order('name');
        if (error) return [];
        return data;
      } catch (e) {
        return [];
      }
    }
  });

  const toggleAvailability = async (id: string, isSoldOut: boolean) => {
    await supabase.from('products').update({ is_sold_out: !isSoldOut }).eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['admin_products'] });
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Produtos & Cardápio</h1>
          <p className="text-muted-foreground mt-2">Gerencie os itens, preços e disponibilidade no cardápio público em tempo real.</p>
        </div>
        <Button className="bg-red-600 hover:bg-red-700 text-white">
          <Plus className="mr-2 h-4 w-4" /> Novo Produto
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Todos os Produtos</CardTitle>
              <CardDescription>Sincronizado automaticamente com o site e Chatbot.</CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                <Input placeholder="Buscar produto..." className="pl-8 w-64" />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Preço Base</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center">Carregando cardápio...</TableCell></TableRow>
              ) : products.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    Sem dados suficientes
                  </TableCell>
                </TableRow>
              ) : (
                products.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-100 rounded object-cover overflow-hidden flex items-center justify-center border">
                          {product.product_images?.[0]?.url ? (
                            <img src={product.product_images[0].url} alt={product.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-xs text-gray-400">Sem foto</span>
                          )}
                        </div>
                        {product.name}
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-500">{(product.category as any)?.name || 'Sem categoria'}</TableCell>
                    <TableCell className="font-medium">{formatCurrency(product.price || 0)}</TableCell>
                    <TableCell>
                      {!product.is_sold_out ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Disponível</Badge>
                      ) : (
                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Esgotado</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right flex items-center justify-end gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className={!product.is_sold_out ? "text-orange-600 hover:text-orange-700" : "text-green-600 hover:text-green-700"}
                        onClick={() => toggleAvailability(product.id, product.is_sold_out)}
                      >
                        {!product.is_sold_out ? (
                          <><PackageX className="w-4 h-4 mr-1" /> Marcar Esgotado</>
                        ) : (
                          <><PackageCheck className="w-4 h-4 mr-1" /> Reativar</>
                        )}
                      </Button>
                      <Button variant="ghost" size="sm" className="text-blue-600">
                        <Edit2 className="w-4 h-4 mr-1" /> Editar
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
