import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MessageSquareWarning, UserCheck, BookPlus, MessageSquare } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { fetchIAPendencies, resolveIAPendency } from '@/lib/admin-data'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'

export const Route = createFileRoute('/admin/pendencias-ia')({
  component: AdminPendenciasIAPage,
})

function AdminPendenciasIAPage() {
  const queryClient = useQueryClient();

  const { data: pendencias = [], isLoading } = useQuery({
    queryKey: ['admin_ia_pendencias'],
    queryFn: fetchIAPendencies,
  });

  const handleResolve = async (id: string) => {
    const success = await resolveIAPendency(id, 'admin');
    if (success) {
      toast.success("Atendimento assumido. A IA foi pausada para este cliente.");
      queryClient.invalidateQueries({ queryKey: ['admin_ia_pendencias'] });
    } else {
      toast.error("Erro ao assumir o atendimento.");
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto h-full flex flex-col">
      <div className="flex justify-between items-start md:items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-3">
            <MessageSquareWarning className="w-8 h-8 text-amber-500" />
            Pendências da IA (Brenda)
          </h1>
          <p className="text-muted-foreground mt-2">
            Central de atendimentos repassados para humanos quando a inteligência artificial precisa de ajuda.
          </p>
        </div>
      </div>

      <div className="flex-1">
        {isLoading ? (
          <div className="py-20 text-center text-muted-foreground">Carregando pendências...</div>
        ) : pendencias.length === 0 ? (
          <Card className="border-dashed border-2 bg-slate-50/50 dark:bg-slate-900/50 h-64 flex flex-col items-center justify-center text-slate-500">
            <MessageSquare className="w-12 h-12 mb-4 text-slate-300 dark:text-slate-700" />
            <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300">Nenhuma pendência no momento</h3>
            <p className="text-sm">A inteligência artificial está conseguindo resolver todos os atendimentos.</p>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {pendencias.map(pendencia => (
              <Card key={pendencia.id} className="border-amber-200/60 bg-amber-50/20 dark:border-amber-900/30 dark:bg-amber-900/5 shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="pb-3 flex flex-row items-start justify-between">
                  <div className="min-w-0 pr-4">
                    <CardTitle className="text-base text-gray-800 dark:text-gray-200 truncate flex items-center gap-2">
                      <MessageSquareWarning className="w-4 h-4 text-amber-500 shrink-0" />
                      {pendencia.customer_name || 'Cliente Desconhecido'}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-2 mt-1">
                      <span>{pendencia.customer_phone}</span>
                      <span>•</span>
                      <span>{formatDistanceToNow(new Date(pendencia.created_at), { addSuffix: true, locale: ptBR })}</span>
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 shrink-0">
                    Aguardando Humano
                  </Badge>
                </CardHeader>
                <CardContent>
                  <div className="bg-background p-4 rounded-xl border shadow-sm mb-4 text-sm space-y-4">
                    <div>
                      <strong className="text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-1 text-xs uppercase tracking-wider">
                        Cliente perguntou:
                      </strong>
                      <p className="text-slate-900 dark:text-slate-100 italic">"{pendencia.user_message}"</p>
                    </div>
                    {pendencia.bot_response && (
                      <div className="pt-3 border-t">
                        <strong className="text-slate-500 flex items-center gap-1.5 mb-1 text-xs uppercase tracking-wider">
                          Contexto da Brenda (IA):
                        </strong>
                        <p className="text-slate-600 dark:text-slate-400 text-xs">
                          {pendencia.bot_response}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button 
                      size="sm" 
                      className="bg-amber-600 hover:bg-amber-700 text-white" 
                      onClick={() => handleResolve(pendencia.id)}
                    >
                      <UserCheck className="w-4 h-4 mr-2" /> 
                      Assumir Atendimento
                    </Button>
                    <Button size="sm" variant="outline" className="hidden sm:flex">
                      <BookPlus className="w-4 h-4 mr-2" /> 
                      Adicionar à Base de Conhecimento
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
