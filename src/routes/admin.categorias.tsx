import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Edit2, Trash2, GripVertical, AlertCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

export const Route = createFileRoute('/admin/categorias')({
  component: AdminCategoriasPage,
})

function AdminCategoriasPage() {
  const { data: categorias = [], isLoading } = useQuery({
    queryKey: ['admin_categories'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase.from('categories').select('*').order('sort_order', { ascending: true });
        if (error) return [];
        return data;
      } catch (e) {
        return [];
      }
    }
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Categorias</h1>
          <p className="text-muted-foreground mt-2">Organize o seu cardápio criando e ordenando categorias (Sincronizado com dados reais).</p>
        </div>
        <Button className="bg-red-600 hover:bg-red-700 text-white">
          <Plus className="mr-2 h-4 w-4" /> Nova Categoria
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12 text-gray-500">Carregando...</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {categorias.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center py-12 text-gray-500 bg-gray-50 border border-dashed rounded-lg">
              <AlertCircle className="w-8 h-8 mb-2 text-gray-300" />
              <p>Nenhuma categoria registrada ainda.</p>
            </div>
          ) : (
            categorias.map((cat) => (
              <Card key={cat.id} className={!cat.is_active ? 'opacity-60' : ''}>
                <CardHeader className="flex flex-row items-start justify-between pb-2">
                  <div className="space-y-1">
                    <CardTitle className="text-xl flex items-center gap-2">
                      <GripVertical className="h-4 w-4 text-gray-400 cursor-move" />
                      {cat.name}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center space-x-2 text-sm text-muted-foreground mt-2">
                    <span className={`h-2 w-2 rounded-full ${cat.is_active ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                    <span>{cat.is_active ? 'Visível no cardápio' : 'Oculta do cardápio'}</span>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-end space-x-2 pt-4 border-t">
                  <Button variant="outline" size="sm" className="text-gray-600">
                    <Edit2 className="h-4 w-4 mr-2" /> Editar
                  </Button>
                  <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardFooter>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  )
}
