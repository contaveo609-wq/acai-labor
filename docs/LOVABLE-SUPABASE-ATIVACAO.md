# Ativar Açaí Labor no Lovable com o Supabase próprio

Projeto Supabase: `njhlctqpqgbdqrgursjm` (`https://njhlctqpqgbdqrgursjm.supabase.co`).
A migração `20261028183729_acai_labor_persistent_store.sql` já foi aplicada e os 122 produtos já estão na tabela `labor_state` para a loja `acai-labor`.

## 1. Segredos do servidor

No painel de hospedagem da versão publicada, cadastre as variáveis abaixo **somente no servidor**. Nunca use prefixo `VITE_` para segredos e nunca os cole no chat ou no GitHub.

| Nome | Valor |
| --- | --- |
| `LABOR_STORAGE` | `supabase` |
| `LABOR_STORE_ID` | `acai-labor` |
| `SUPABASE_URL` | `https://njhlctqpqgbdqrgursjm.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave `service_role` ou `sb_secret_...` do projeto em Supabase → Project Settings → API Keys |
| `LABOR_ADMIN_SETUP_TOKEN` | Segredo aleatório com pelo menos 32 caracteres, usado uma vez para criar a senha do admin |
| `LABOR_SESSION_SECRET` | Outro segredo aleatório, diferente do token anterior, para assinar sessões |
| `LABOR_PUBLIC_BASE_URL` | URL HTTPS final da loja, sem barra no fim |

Se o Lovable permitir segredos de execução para o app TanStack Start, cadastre esses valores em **More → Secrets**. Confirme que aparecem em `process.env` apenas no lado servidor. Se a interface guardar segredos exclusivamente para Edge Functions, não publique o app com essa configuração: esse código precisa dos segredos nas funções do servidor TanStack Start.

## 2. Supabase e GitHub no Lovable

O projeto Lovable antigo, [“Pixel Perfect Replica (93)”](https://lovable.dev/projects/8df38b8d-e4cf-46dc-99d3-452b64c50126), usa o backend interno do Lovable. A consulta ao banco interno retornou zero tabelas públicas, zero usuários e zero arquivos em 28/10/2026. Para conectá-lo como integração oficial ao Supabase próprio é necessário trocar o backend; o Lovable não faz a migração automaticamente.

No editor desse projeto: **More → Database → Manage → Settings → Remove database**. Confira antes que o banco continua vazio, pois a remoção apaga dados, usuários, arquivos e backups. Depois: **Settings → General → External Supabase → Connect**, conecte a organização Supabase e selecione `njhlctqpqgbdqrgursjm`. Caso essa opção não apareça após remover o backend, crie um projeto novo pelo Dashboard → `+` → Databases e selecione o Supabase antes de gerar o app.

O Git sync do Lovable cria **um repositório novo** e não importa nem vincula diretamente `contaveo609-wq/acai-labor`. A versão atual do código deve continuar no repositório do usuário. Para usar Lovable Git sync, conecte a conta GitHub em Workspace settings → Git e conecte o novo projeto em Project settings → Git. Depois decida qual repositório será o principal; não substitua nem renomeie o repositório existente sem conferir o histórico.

Importar o ZIP pelo Lovable usa créditos de build e pode recriar o backend interno. Com poucos créditos, conclua primeiro a conexão ao Supabase. O ZIP `acai-labor-supabase-2026-10-28.zip` foi entregue separadamente; envie-o uma única vez no chat do projeto Lovable com a instrução de atualizar o código sem trocar o backend conectado. Confira a estimativa de créditos apresentada pelo Lovable antes de iniciar.

## 3. Conferência antes de aceitar pedidos reais

1. Abra a loja publicada e confirme que o catálogo está habilitado.
2. Faça um pedido de **teste**, selecione Pix e abra o QR Code e o código copia e cola. Não transfira dinheiro no teste.
3. Clique “Já fiz o pagamento”. O pedido deve entrar como **Em análise**, com pagamento pendente.
4. Abra `/admin`; no primeiro acesso, use o token de configuração cadastrado no servidor para criar a senha. Confira o pedido e seus itens em Pedidos.
5. Só marque o pagamento como confirmado após conferir o recebimento fora do sistema. Não há integração com gateway; clicar “Já fiz o pagamento” é uma declaração do cliente, não uma confirmação bancária.
6. Em Admin → Chatbot, configure limites diário, por minuto e por conversa do chatbot do site. Os limites são compartilhados entre instâncias quando `LABOR_STORAGE=supabase`.

Não ative pedidos reais até confirmar que o painel mostra **Dados salvos no Supabase** e que um pedido de teste permanece após reiniciar o servidor.
