# Supabase e hospedagem Lovable

## Estado atual

O repositório já contém as migrations em `supabase/migrations/` e os clientes
Supabase em `src/integrations/supabase/`. O modo que passou nos testes locais
continua sendo `labor.service`, que grava em `.local/labor/data.json`. Ele é
adequado para desenvolvimento e demonstração, mas não é a persistência final
para Vercel ou Lovable.

Não ative `LABOR_STORAGE=supabase` antes de concluir a troca do serviço de
pedidos. A variável está documentada para separar explicitamente os ambientes;
ela não deve ser usada como se a migração já estivesse concluída.

## Preparar um projeto Supabase

1. No Lovable, abra o projeto conectado ao GitHub e use **Connect Supabase**.
   Se preferir criar o projeto no painel Supabase, copie a URL, a chave pública
   e a chave secreta do projeto.
2. Execute as migrations em ordem, pelo Supabase CLI ou SQL Editor.
   `20260909182543_e312ef4c-3f7b-4915-896a-0a4cbf65489f.sql` somente se ela
   Aplique os arquivos de `supabase/migrations/` por data crescente. Em caso de
   dúvida, use `supabase db push` a partir da raiz, depois revise o diff.
3. Confirme que as tabelas `delivery_stores`, `delivery_products`,
   `delivery_orders`, itens, clientes, auditoria, WhatsApp e Gemini existem e
   que RLS está habilitado.
4. Migre o catálogo local para a loja do Supabase e faça uma compra de teste
   com um usuário anônimo. O preço e o estoque precisam ser calculados no
   servidor/transação, nunca no navegador.

## Variáveis no Lovable ou Vercel

Configure em **Production** e **Preview**:

```text
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY
LOVABLE_DB_MIGRATION_URL
LABOR_STORAGE=supabase
LABOR_PUBLIC_BASE_URL=https://seu-dominio-publico
LABOR_ENCRYPT_DATA=1
```

As chaves `SUPABASE_SERVICE_ROLE_KEY`, `LOVABLE_DB_MIGRATION_URL`, WhatsApp,
Gemini e pagamentos são somente do servidor. Não use prefixo `VITE_` nelas.
Depois de salvar as variáveis, faça um novo deploy; alterações de ambiente não
entram em uma função já publicada.

## O que ainda precisa ser implementado no código

Antes de abrir a loja para alto tráfego, o adaptador Supabase precisa substituir
o caminho local para: catálogo, checkout, idempotência, estoque, pedidos,
clientes, sessões administrativas, conversas e notificações. A troca deve usar
transações/RPC existentes, RLS por `store_id` e índices únicos para
`request_id`. O modo local deve permanecer somente para `npm run dev` e testes.

## Publicação segura

1. Aplicar e revisar migrations em um projeto Supabase de staging.
2. Rodar `npm run typecheck`, `npm test`, `npm run build` e `npm run test:ui`.
3. Fazer um pedido real de teste, cancelar, verificar estoque, auditoria e
   isolamento entre lojas.
4. Configurar domínio HTTPS e webhook Meta somente depois de validar o staging.
5. Publicar pelo Lovable ou Vercel conectado ao branch `main`. Commits enviados
   ao branch conectado sincronizam com o Lovable; não faça force-push.

Até a troca do adaptador, mantenha `LABOR_STORAGE=local` apenas em ambiente
local e não trate o deploy atual como banco de produção.
