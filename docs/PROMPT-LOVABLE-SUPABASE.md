# Prompt para Lovable — conectar Supabase sem reconstruir o projeto

Cole o texto abaixo no Lovable depois de importar o repositório:

```text
Você está trabalhando no repositório existente:
https://github.com/contaveo609-wq/acai-labor.git

Objetivo: conectar este projeto Açaí Labor ao Supabase do Lovable, preservando
todo o código, layout, catálogo, rotas, testes e histórico do Git.

REGRAS PARA ECONOMIZAR CRÉDITOS
1. Não recrie o projeto, não gere uma aplicação nova e não altere o design.
2. Não reescreva arquivos que já funcionam.
3. Antes de editar, inspecione package.json, src/lib/labor.service.ts,
   src/integrations/supabase/, supabase/migrations/ e docs/SUPABASE-LOVABLE-DEPLOY.md.
4. Faça somente as alterações necessárias para a persistência Supabase.
5. Trabalhe em uma única etapa e mostre os arquivos alterados antes de aplicar.
6. Não adicione iFood, 99Food, gateway de pagamento ou dependências novas.
7. Nunca exponha SUPABASE_SERVICE_ROLE_KEY, tokens WhatsApp ou chave Gemini no
   navegador, em arquivos VITE_ ou em mensagens de log.
8. Não faça force-push, reset, rebase ou squash do histórico existente.

ESTADO IMPORTANTE
- O catálogo local tem 122 produtos e já está validado.
- O modo local usa labor.service e data.json para desenvolvimento.
- O projeto já contém clientes Supabase, tipos e migrations.
- As migrations devem ser aplicadas em ordem crescente a partir da pasta
  supabase/migrations/.
- A troca para Supabase precisa ser explícita: mantenha o modo local funcionando
  e use o banco remoto somente quando LABOR_STORAGE=supabase.

TAREFA
1. Conecte este projeto ao Supabase usando a integração nativa do Lovable.
2. Aplique/revise as migrations existentes em supabase/migrations/ em ordem.
   Não crie tabelas paralelas com nomes diferentes.
3. Confirme que existem e estão protegidas por RLS as tabelas de lojas,
   categorias, produtos, variações, adicionais, pedidos, itens, clientes,
   estoque, auditoria, conversas WhatsApp, CRM, campanhas, fidelidade e Gemini.
4. Use store_id para isolamento entre lojas.
5. Preserve as RPCs existentes para transição de pedido, auditoria e regras de
   concorrência. Preços, descontos e estoque devem ser calculados no servidor.
6. Implemente o adaptador/repositório Supabase para catálogo, checkout,
   idempotência por request_id, estoque, pedidos, clientes, sessões,
   conversas e notificações. Não remova o adaptador local.
7. Adicione ou ajuste apenas as variáveis de ambiente do servidor:
   SUPABASE_URL
   SUPABASE_PUBLISHABLE_KEY
   SUPABASE_SERVICE_ROLE_KEY
   LOVABLE_DB_MIGRATION_URL
   LABOR_STORAGE=supabase
   LABOR_ENCRYPT_DATA=1
   LABOR_PUBLIC_BASE_URL=https://[dominio-publico]
8. Use a chave pública apenas em consultas protegidas por RLS. Use a service
   role somente em server functions/server routes.
9. Não coloque valores reais de credenciais no Git ou em arquivos .env
   commitados.
10. Atualize README/docs somente para explicar configuração, migração e rollback.

VALIDAÇÃO OBRIGATÓRIA
Execute sem reescrever os testes:
- npm run typecheck
- npm test
- npm run build
- npm run test:ui

Depois faça um teste manual com uma loja de staging:
- abrir catálogo anônimo;
- criar um pedido de teste;
- confirmar que request_id repetido não duplica o pedido;
- reservar e cancelar estoque;
- avançar status com a RPC;
- confirmar que outra loja não consegue ler o pedido;
- verificar auditoria e histórico;
- confirmar que nenhuma chave secreta aparece na resposta do navegador.

Se a integração Supabase ainda não puder ser concluída com segurança, pare após
configurar a conexão e informe exatamente qual migration, variável ou arquivo
está faltando. Não simule sucesso e não altere o fluxo para esconder a falha.
``` 

## Configuração rápida no Lovable

1. Importe `contaveo609-wq/acai-labor` pela branch `main`.
2. Use **Connect Supabase** no projeto importado.
3. Cole o prompt acima em uma única mensagem.
4. Configure as variáveis de ambiente no painel do Lovable, separando Preview e
   Production.
5. Não cole tokens neste prompt nem em arquivos do Git.
6. Só publique depois que os quatro comandos de validação passarem.

O arquivo não contém credenciais. Ele é seguro para permanecer no repositório.
