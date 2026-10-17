# Vendrex V2 — Fase 1

Evolução incremental da V1 de Açaí Labor/Skina para uma distribuidora. Nenhum banco externo foi modificado. O catálogo existente continua com 12 produtos do material fornecido; o administrador pode cadastrar bebidas, alimentos e outras categorias. Não foram inventados produtos, preços ou saldos de estoque para preencher a interface.

## Funcionalidades

- Identidade Vendrex, ilustração original de distribuição, layout responsivo e movimento reduzido. Nome, frase, descrição, logo, cores, título, texto e imagem principal são editáveis em Minha loja. A marca inicial é provisória.
- Busca por nome, descrição, SKU, tamanho e endereço do produto, sem distinção de acentos/espaços; filtros de embalagem, promoção, disponibilidade e ordenação por preço. Imagens e produtos V1 preservados.
- Unidade, kg, litro, caixa, fardo, pacote e combo. Preço, mínimo e incremento por opção de compra. Frações até três casas para kg/litro. Adicionais continuam calculados por unidade de venda selecionada. Promoções do produto aplicam-se à opção base; embalagens têm preço próprio.
- Carrinho persistente, personalização, revisão de compra, opções de pagamento presencial distintas e regras validadas pelo servidor: categoria/produto/opção disponíveis, vínculos e limites de adicionais, preço, cupom, mínimo após descontos, entrega, retirada, horários e agendamento em Brasília. Fechar a loja manualmente bloqueia novos pedidos e novos agendamentos.
- Central com busca por cliente/número/telefone, data, entrega/retirada e colunas operacionais. Histórico com autor, transições sequenciais, motivo obrigatório para cancelar, controle de atualização concorrente, notas privadas e impressão sem dados internos. Atualização periódica de 8 segundos no painel e 5 segundos no acompanhamento.
- Financeiro separado da operação. Todas as compras desta fase entram com pagamento pendente. Concluir uma entrega não confirma recebimento. Dashboard separa valor pedido, recebimentos, pendências e ticket médio; não calcula lucro fictício.
- Auditoria local de cadastros, configuração, criação e transições de pedidos. Sem endpoint para editar/excluir registros. Ela não é inviolável: quem controla os arquivos no computador pode alterá-los. Produção requer armazenamento externo protegido e retenção.
- Migração aditiva dos dados locais na leitura/gravação; IDs, produtos, pedidos e senha anterior preservados. Se o nome ainda era exatamente Açaí Labor, passa a Vendrex; um nome personalizado é preservado. A primeira gravação persiste a versão 2. O arquivo de senha não é migrado nem redefinido.

## Correções de segurança

- 17 RPCs antigas de WhatsApp/Gemini agora exigem autenticação/perfil administrativo no servidor e estão bloqueadas no modo local. O webhook também retorna 503 no modo local.
- Consulta remota de pedido usa usuário autenticado/RLS, sem leitura aberta por UUID com service role.
- Checkout remoto antigo bloqueado por não possuir transação nem validação completa de adicionais. A compra local usa o serviço validado e permanece funcional.
- A gravação de chave Gemini em texto no campo legado “encrypted” foi bloqueada. Não foram adicionadas chaves ou contas recebedoras.
- Contagem de falhas de login corrigida para solicitações concorrentes. Sessão de visitante estabelecida antes do pedido. Idempotência com comparação do conteúdo da tentativa.
- Cadastros validam IDs/vínculos de opções, SKU/endereço duplicado, formatos de imagem, períodos e regras de quantidade. Descrições e observações são renderizadas como texto React.

## Arquivos principais

Domínio: `src/lib/vendrex.rules.ts`, `labor.schema.ts`, `labor.service.ts`, `labor.functions.ts`, `labor.types.ts`, `menu.ts`, `cart.tsx`.

Interface: `DistributionIllustration.tsx`, `VendrexTheme.tsx`, `LaborHome.tsx`, `LaborHeader.tsx`, `MenuBrowser.tsx`, `ProductCard.tsx`, `ProductDialog.tsx`, `LaborCheckout.tsx`, `LaborAssistant.tsx`, `SiteFooter.tsx`, `admin/LaborAdmin.tsx`, `admin/VendrexFields.tsx`, `admin/VendrexOrders.tsx`, `src/vendrex.css`, favicon e rotas públicas/administração.

Segurança legada: `legacy-access.ts`, `orders.functions.ts`, `orders.server.ts`, `chat.functions.ts`, `whatsapp.server.ts`, `routes/api/webhook.whatsapp.ts`.

Qualidade/execução: `src/router.tsx`, `routes/__root.tsx`, `tests/labor.test.ts`, `tests/vendrex.test.ts`, `tests/rls.test.ts`, `tests/ui.mjs`, `package.json`, `package-lock.json`, `INICIAR.bat`, `.env.example` e documentação.

## Banco e RLS

Migração incremental: `supabase/migrations/20261017010000_vendrex_phase1.sql`, dependente apenas da migração isolada `20261016010000_delivery_multistore.sql`.

Acrescenta unidades/embalagens, quantidade fracionada, status financeiro, agendamento, idempotência de pedidos autenticados, histórico/auditoria e RPC de transição de status com bloqueio de linha. Restringe catálogo público a itens ativos e seus ancestrais ativos. Revoga edição direta de pedidos/valores por papéis de navegador; permite mudança operacional somente pela RPC autorizada. Não altera tabelas legadas.

As duas migrações foram executadas em PostgreSQL embarcado (PGlite), com papéis anon/authenticated e emulação de `auth.uid()`. Isso valida SQL, constraints, privilégios, RLS e RPC localmente. Não equivale a testar Supabase Auth, PostgREST, rede, JWT ou infraestrutura real. Não foi aplicado SQL ao Supabase remoto. A interface usa o adaptador de arquivos local, não essas tabelas.

## Dependências das próximas fases

Para uma operação pública, ainda são obrigatórios: ambiente Supabase de homologação autorizado, adaptador de persistência e checkout transacional/RPC, autenticação de cliente/visitante remota, testes contra Supabase real, RBAC completo, MFA para financeiro, HTTPS, proteção contra abuso distribuído, backup/restauração, retenção e observabilidade.

Fase 2: PSP e conta recebedora autorizados, sandbox, Pix/cartão, webhooks/replay/conciliação/reembolso e caixa. Não há QR Code Pix ativo nem confirmação manual de recebimento nesta fase.

Fase 3: estoque por SKU/embalagem, reservas/baixa/reversão atômicas e logística. Disponibilidade publicada/esgotada funciona, mas não há contagem física ou proteção transacional contra falta de estoque ainda.

Fase 4: Gemini oficial, configuração segura, modelos e limites reais, consumo, ferramentas estruturadas e atendimento. O componente de ajuda atual usa somente o catálogo. Não é Gemini. WhatsApp oficial depende de credenciais e teste ponta a ponta.

Fases 5–6: campanhas/stories/fidelidade/cashback/cupons avançados, consentimento/analytics, PDV, mesas opcionais, relatórios avançados e carga. A administração local continua sendo de um proprietário; os cinco perfis completos são uma evolução posterior. Nenhuma integração fiscal ou marketplace foi criada.

## Custos e configurações

Execução local não exige serviço pago. Serviços externos e seus custos dependem de hospedagem, plano Supabase, PSP, conta/modelo Gemini e WhatsApp escolhidos; nenhum plano foi contratado. Taxa, mínimo, horários, contato, endereço e promoções devem ser confirmados pelo estabelecimento. O mínimo inicial é zero para preservar a demonstração V1 e deve ser configurado pela loja. LABOR10 e adicionais de copo indicados como demonstração continuam exemplos de teste.
