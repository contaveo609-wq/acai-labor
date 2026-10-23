# Central de tráfego pago — Açaí Labor

## Auditoria e arquitetura

O painel ativo usa `LaborAdmin`, autenticação por cookie HTTP-only, MFA para ações sensíveis e `labor.service` para persistência local. A antiga rota `admin.campanhas.tsx` era um placeholder; campanhas de mensagens existem em `LaborOperations`. O catálogo atual contém 122 produtos. Pedidos e clientes locais são usados pelo CRM. O gateway de pagamento real e o adaptador Supabase de pedidos ainda não existem. Portanto nenhum pedido de demonstração representa receita real.

O módulo usa `ads.service` com as dependências existentes: autenticação, cofre, fila de alterações e auditoria. O transporte Meta valida origem fixa, bloqueia redirects, usa timeouts e não repassa erros externos com tokens. Respostas externas são reduzidas a DTOs. O token OAuth fica no cofre separado `meta-ads`, sem reutilizar credenciais do WhatsApp. Não existem resultados simulados no dashboard.

## Operações disponíveis

- Rascunhos por produto existente, objetivo, orçamento diário/total, datas, idades, cidade Meta e Facebook/Instagram.
- OAuth com state de uso único, expiração de dez minutos e vínculo à sessão administrativa com MFA. Callback `/api/meta-ads/callback`.
- Seleção de conta autorizada com moeda BRL, campanhas e métricas diárias com filtros até 90 dias. Consulta de anúncios e estado efetivo de análise.
- Criação de campanha pausada. Para objetivos tráfego/vendas, criação de conjunto pausado com orçamento em centavos e anúncio pausado usando post existente da página (`pageId_postId`). Objetivos adicionais podem ser criados no nível campanha; configuração do conjunto depende do Gerenciador Meta.
- Ativação/pausa exige confirmação explícita e MFA. Jobs e IDs parciais são preservados. Resultado financeiro ambíguo bloqueia reenvio automático.
- Gemini: uma geração de três sugestões por semana UTC, liberação adicional explícita. Tentativas são reservadas antes da chamada, inclusive falhas, para controlar consumo.
- Métricas, gráfico por dia, comparação por campanha, CSV protegido contra fórmulas e impressão para salvar PDF pelo navegador.
- Recomendações determinísticas explicam CTR, CPA, ROAS e queda de CTR. Nenhuma redistribuição automática de verba.
- Campanhas WhatsApp anteriores continuam na aba própria.

## Rastreamento

O visitante escolhe permitir ou recusar medição. Sem consentimento não há Pixel, evento remoto nem UTM persistida. Com consentimento: PageView, ViewContent, AddToCart e InitiateCheckout usam UUID por evento. Pixel e CAPI compartilham `event_name` e `event_id`. O visitante é identificado por UUID convertido em SHA-256 no servidor; nome, telefone, endereço e texto de pedido não são enviados. Registros locais ficam por 30 dias, com limite de 10.000.

UTM campaign/source/medium consentidos são associados ao pedido no servidor como origem declarada. Eles não provam atribuição causal. Receita e compras Meta permanecem distintas dos pedidos pagos do sistema. Nenhum endpoint público aceita Purchase. O fluxo atual só cria pedidos de teste; Purchase real exige confirmação autorizada de pagamento, pedido não cancelado e identificador estável por pedido. Esse gatilho depende do gateway futuro.

CAPI possui envio explícito em lote no painel, limitado a 100 eventos, sem retry de resultado ambíguo. Não há scheduler em produção neste checkout. Renovação de token, revogação/remoção de dados pela Meta, fila remota e envio contínuo devem ser implementados antes de operação pública.

## Configurar e validar

Defina no servidor `META_ADS_APP_ID`, `META_ADS_APP_SECRET`, `META_ADS_API_VERSION` suportada pelo aplicativo, `META_ADS_REDIRECT_URI`, `META_ADS_PIXEL_ID`, `META_ADS_CAPI_TOKEN` e `LABOR_PUBLIC_BASE_URL`. Use HTTPS e callback idêntico ao cadastrado em Facebook Login. Permissões solicitadas: `ads_read`, `ads_management`, `business_management`. A disponibilidade depende de acesso ao aplicativo, conta, revisão Meta e permissões da página/post. Configure a chave Gemini e modelo pelo painel de IA existente. Segredos nunca recebem prefixo VITE_.

Os testes usam transporte controlado e não publicam anúncios nem consomem saldo Meta/Gemini. A conta real, aprovação, compra e publicação não foram testadas.

## Supabase e Lovable

`20261023090000_labor_paid_media.sql` prepara tabelas isoladas para rascunhos, métricas, eventos, jobs, criativos e auditoria com RLS. Nenhuma seed Skina é necessária. Membros só são cadastrados por backend privilegiado; navegador não tem escrita financeira. A migration não foi aplicada ao banco remoto. O repositório Supabase do módulo ainda precisa ser conectado; aplicar SQL sozinho não torna arquivos locais persistentes.

Não habilite anúncios reais em Vercel/Lovable usando arquivos temporários. A fila atual garante exclusão apenas no processo local. Em produção a reserva de jobs e eventos deve ser transacional no Postgres, compartilhada entre instâncias. Sessões e OAuth precisam de armazenamento compartilhado. Credenciais devem ficar em secret manager/cofre remoto, com privilégio mínimo.

## Limitações explícitas

Pendentes: edição remota completa de orçamento/conjunto, públicos personalizados, upload de criativos novos, recomendações geradas por IA com desempenho, redistribuição automática, atribuição direta por produto/período no relatório, scheduler, persistência remota, Purchase e confirmação financeira. O orçamento planejado do rascunho é aplicado ao criar conjunto; editar rascunho não edita orçamento de conjunto já enviado. Ativar somente campanha ou anúncio não ativa automaticamente todos os níveis. Revise cada nível no Gerenciador Meta.

## Evolução da análise em 23/10/2026

O painel passou a filtrar campanhas no período selecionado e a explicar cada recomendação com amostra, confiança e risco. A sugestão de testar aumento de até 10% só aparece após pelo menos sete registros diários e dez compras reportadas pela Meta, com ROAS e CPA dentro das metas. Ela não altera orçamento. A inteligência comercial soma apenas pedidos não demonstrativos, pagos e não cancelados; mostra unidades, receita de itens, ticket médio e origem UTM declarada. Pedidos reembolsados não contam. Receita não representa lucro. A aba de geração de criativos com IA continua ausente por solicitação direta do proprietário; o serviço antigo permanece inacessível pela interface.

A migration de tráfego pago ainda não foi aplicada ao Supabase remoto. O painel continua em arquivos locais e a fila de proteção financeira continua limitada a um processo. Não ative operações pagas em múltiplas instâncias até implementar transações compartilhadas, sessões e cofre persistentes. A exportação PDF ainda usa a impressão do navegador. Compra real, renovação do token Meta, comparação de criativos e execução automática continuam pendentes.
