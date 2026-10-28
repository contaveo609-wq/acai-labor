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

O projeto Lovable antigo, “Pixel Perfect Replica (93)”, usa o backend interno do Lovable. Para conectá-lo como integração oficial ao Supabase próprio é necessário migrar o backend; o Lovable não faz a troca automaticamente. Como o banco interno antigo está vazio, o caminho mais limpo é criar/importar um projeto novo escolhendo o Supabase próprio antes de ativar outro backend. No Lovable: Dashboard → `+` → Databases → conectar a organização Supabase → escolher o projeto `njhlctqpqgbdqrgursjm`.

O Git sync do Lovable cria **um repositório novo** e não importa nem vincula diretamente `contaveo609-wq/acai-labor`. A versão atual do código deve continuar no repositório do usuário. Para usar Lovable Git sync, conecte a conta GitHub em Workspace settings → Git e conecte o novo projeto em Project settings → Git. Depois decida qual repositório será o principal; não substitua nem renomeie o repositório existente sem conferir o histórico.

Importar o ZIP pelo Lovable usa créditos de build. Com poucos créditos, faça primeiro a ativação do servidor e teste o código já versionado; importe o ZIP somente quando houver orçamento para a migração.

## 3. Conferência antes de aceitar pedidos reais

1. Abra a loja publicada e confirme que o catálogo está habilitado.
2. Faça um pedido de **teste**, selecione Pix e abra o QR Code e o código copia e cola. Não transfira dinheiro no teste.
3. Clique “Já fiz o pagamento”. O pedido deve entrar como **Em análise**, com pagamento pendente.
4. Abra `/admin`; no primeiro acesso, use o token de configuração cadastrado no servidor para criar a senha. Confira o pedido e seus itens em Pedidos.
5. Só marque o pagamento como confirmado após conferir o recebimento fora do sistema. Não há integração com gateway; clicar “Já fiz o pagamento” é uma declaração do cliente, não uma confirmação bancária.
6. Em Admin → Chatbot, configure limites diário, por minuto e por conversa do chatbot do site. Os limites são compartilhados entre instâncias quando `LABOR_STORAGE=supabase`.

Não ative pedidos reais até confirmar que o painel mostra **Dados salvos no Supabase** e que um pedido de teste permanece após reiniciar o servidor.
