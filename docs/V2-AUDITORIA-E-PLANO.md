# Vendrex Distribuidora V2 — auditoria e plano

Data: 17/10/2026. Escopo desta entrega: Fase 1 do documento fornecido. A evolução usa a V1 existente, sem reconstruir o projeto. O ZIP entregue anteriormente e um snapshot privado em `work/v1-antes-vendrex-20261017.zip` preservam o ponto de partida. O snapshot privado contém dados locais e não deve ser publicado.

## Estrutura inspecionada

- React 19 + TypeScript estrito, TanStack Start/Router/Query, Vite 8, Nitro Node, Tailwind e Radix. Rotas em `src/routes`, interface em `src/components`.
- Dois caminhos coexistem: demonstração local (`labor.*`, ativada por `VITE_DEMO_MODE`) e legado Skina/Supabase (`orders.*`, `admin-data`, `whatsapp.server`, `chat.functions`). O legado inclui telas de estoque/logística/marketing apenas parcialmente conectadas ao caso atual.
- Persistência local em `.local/labor/data.json`, fila de mutações e substituição atômica. Senha scrypt em arquivo separado; tokens de sessão aleatórios com hash em memória. Uma loja, um proprietário, um processo. Não é um adaptador PostgreSQL.
- Catálogo real importado do ZIP: 12 produtos, cinco categorias, imagens, promoções, grupos e adicionais. Carrinho persistente, revisão de compra, idempotência, verificação de propriedade do pedido, editor de produtos/categorias/loja e acompanhamento por polling já existem.
- Histórico SQL legado de setembro/outubro, configuração Supabase e migração independente `delivery_*`. Não há ambiente Supabase de homologação configurado para esta entrega. A migração isolada ainda não tem adaptador de checkout transacional.

## Achados e tratamento

| Prioridade | Evidência no ponto de partida | Tratamento da Fase 1 |
| --- | --- | --- |
| Crítica | Funções administrativas em `whatsapp.server.ts` usam service role sem middleware de autenticação/autorização. | Exigir autenticação e perfil no servidor; bloquear integrações legadas no modo local. |
| Alta | `orders.functions/getOrder` aceita UUID e lê com service role, sem verificar dono. | Exigir sessão autenticada e consulta com RLS no caminho remoto. |
| Alta | `orders.server/createValidatedOrder` não é transacional, não verifica vínculo/grupos de adicionais nem loja fechada. | Impedir ativação acidental do checkout remoto legado; manter o fluxo local validado. A substituição transacional remota é um bloqueador de produção. |
| Alta | Campo legado chamado `gemini_api_key_encrypted` recebe texto sem criptografia. | Não aceitar nova gravação de chave por esse caminho. Fase 4 usará segredo no servidor/gerenciador e permissões. |
| Alta | SQL `delivery_*` deixa catálogo inativo legível e concede UPDATE genérico em pedidos. | Migração incremental com leitura pública filtrada, privilégios mínimos, estados separados e testes com duas lojas. |
| Média | Dashboard conta entrega concluída como receita sem conciliação. | Separar operação e financeiro; pedidos presenciais permanecem pendentes. Não chamar total dos pedidos de lucro/recebimento. |
| Média | Idempotência confere chave/dono mas não conteúdo; primeira criação simultânea pode emitir cookies distintos. | Identidade de visitante antes do checkout e rejeição da mesma chave com outro conteúdo. |
| Média | Limite de login calculado antes da fila; opções têm IDs/vínculos pouco restritos. | Contagem dentro da região serializada e validações de integridade dos cadastros. |
| Funcional | Identidade fixa de açaí, sem embalagens, múltiplos, mínimo ou agendamento. | Identidade Vendrex editável, unidades/opções de venda, regras no servidor, horários e agendamento. |

Inventário: configs, rotas, bibliotecas de domínio/autenticação/integração, componentes de compra/administração, assets e todas as migrações foram mapeados. A revisão se concentrou nas fronteiras de acesso e nos fluxos executados; não equivale a pentest, certificação LGPD, auditoria de dependências ou validação das integrações externas legadas.

## Plano aprovado pelo pedido de execução

1. Fase 1: corrigir fronteiras inseguras; migrar dados locais de forma aditiva; adaptar identidade e catálogo da distribuidora; unidades/embalagens, mínimos e múltiplos; checkout com regras de atendimento; central com transições, histórico, notas e impressão; dashboard honesto; RLS versionada e testes isolados. Rodar localmente.
2. Fase 2: escolher PSP/conta autorizada, validar destinatário/chave, sandbox, MFA para financeiro, API transacional, assinatura/replay de webhooks, reconciliação, caixa e estornos. Os dados de recebedor do documento não são ativados.
3. Fase 3: estoque transacional por SKU/embalagem, reservas/cancelamentos, perdas/validade, entregadores e regiões. Sem dados fictícios de estoque.
4. Fase 4: Gemini oficial, modelos consultados em tempo de configuração, quotas administrativas, telemetria real, permissões de ferramentas, atendimento humano e WhatsApp oficial opcional.
5. Fase 5: cupons avançados/fidelidade/consentimento/campanhas e eventos sem duplicação.
6. Fase 6: balcão, comandas opcionais, relatórios avançados, carga, revisão independente de segurança e implantação.

## Critério de aceite e limites

Testar regressões da V1 e novos casos: valores/adicionais, embalagem e múltiplos, mínimo, horários/agendamento, cupons, indisponibilidade, duplicação concorrente/conflito de chave, proprietário do pedido, transições/cancelamento, notas privadas, login abusivo, persistência, XSS como texto, isolamento RLS e smartphone. Build e TypeScript devem passar. Nenhum teste fará cobrança ou alteração de banco financeiro real.

Pagamentos, Gemini, estoque, fidelidade e PDV completos são fases posteriores. A Fase 1 local não exige serviço pago. Produção requer PostgreSQL/Supabase de homologação, credenciais autorizadas, adaptador transacional, backups/retensão, HTTPS e teste real de Auth/RLS. RLS em PostgreSQL embarcado verifica SQL e isolamento, mas não a infraestrutura remota Supabase.

Referências de implementação: [RLS Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security), [PGlite](https://pglite.dev/docs/), [Playwright/Edge](https://playwright.dev/docs/browsers).
