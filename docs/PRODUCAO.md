# O que funciona e o que falta para produção

> Atualização Vendrex V2 (17/10/2026): consulte `V2-ENTREGA.md` e `V2-TESTES.md` para o estado atual. As seções abaixo registram a V1. A V2 acrescentou regras de venda, horários, agendamento, auditoria, estados operacionais/financeiros separados, bloqueio de endpoints legados inseguros e testes SQL/RLS em PostgreSQL embarcado. Ainda não há adaptador Supabase remoto, pagamentos, estoque físico, Gemini ou RBAC completo em operação. O campo de pedido mínimo agora é aplicado pelo servidor e pode ser configurado em Minha loja.

Esta entrega é uma demonstração local funcional, baseada no projeto Skina. Não foi publicada e não modifica o Supabase original.

## Arquitetura preservada

React 19, TypeScript, TanStack Start/Router/Query, Vite, Tailwind e componentes Radix existentes. O catálogo, os cards, o modal, o carrinho e as rotas existentes foram estendidos. As páginas e integrações originais permanecem no código para continuidade, sem exposição na navegação da demonstração quando dependem de serviços ausentes.

`VITE_DEMO_MODE=true` seleciona o adaptador local em `labor.functions.ts`/`labor.service.ts`. O catálogo e as alterações administrativas são servidos por funções do TanStack Start. Pedidos e configurações ficam em `.local/labor/data.json`, fora de `public/`. A gravação é serializada e usa troca atômica de arquivo. Adequado a um único processo local; não é um banco para múltiplas instâncias.

O primeiro administrador define uma senha de pelo menos 12 caracteres. O servidor armazena salt e hash scrypt em `.local/labor/admin.json`. A sessão tem token aleatório de 256 bits em cookie HttpOnly/SameSite=Strict, expira em 8 horas e é invalidada ao reiniciar o processo. As funções de administração verificam a sessão no servidor. A proteção CSRF existente foi preservada. O servidor limita tentativas de login e aceita chamadas deste adaptador somente por hostname localhost/127.0.0.1/::1. Os comandos de execução vinculam o servidor a 127.0.0.1.

O acompanhamento exige também um cookie HttpOnly do visitante que criou o pedido; saber o UUID de outro pedido não libera acesso. O servidor recalcula preços, descontos, adicionais e entrega em centavos. Confere disponibilidade, categoria, mínimos/máximos e vínculo de cada adicional ao produto. A chave de idempotência evita duplicar a mesma confirmação. Se o total mudar após a revisão, exige nova confirmação.

## Preparação para Supabase

`supabase/migrations/20261016010000_delivery_multistore.sql` prepara tabelas independentes com prefixo `delivery_`, lojas, membros administrativos, categorias, produtos, variações, grupos/adicionais, promoções, clientes, pedidos e itens. Inclui RLS por estabelecimento e chaves compostas para impedir vínculos entre lojas.

A migração NÃO foi aplicada nem testada em um servidor PostgreSQL/Supabase. Não há credenciais autorizadas para um novo ambiente. Ela também não conecta automaticamente o frontend ao banco. Nenhum INSERT de pedidos é concedido ao navegador: ainda deve ser implementada uma RPC transacional restrita ou transação no backend, reutilizando as validações da demonstração, antes de habilitar checkout real.

Próximos passos de produção:

1. Criar ambiente de homologação separado do Skina e revisar/aplicar a migração nova. Não aplicar todo o histórico legado às cegas.
2. Conectar um adaptador Supabase à interface atual, importar `src/data/labor-catalog.json` e provisionar o administrador via Supabase Auth e `delivery_memberships`.
3. Implementar gravação transacional do pedido, sessão de visitante persistente, limites contra abuso, expiração de dados e políticas de upload em Storage por loja.
4. Executar testes de RLS com duas lojas, dois administradores, cliente e visitante. As duas pizzarias estão previstas pelo modelo de dados; não foram criadas interfaces para elas.
5. Revisar as integrações e funções legadas antes de reativá-las. A autenticação administrativa antiga com senha no JavaScript foi substituída por Supabase Auth/RBAC. Isso não representa uma auditoria integral do sistema legado. Em particular, revisar autorização do acompanhamento de pedidos e atomicidade/vínculo dos adicionais no fluxo Supabase antigo.
6. Confirmar logomarca oficial, endereço completo, contato, horários, área/taxa de entrega, pedido mínimo e vigência das promoções. A loja de referência informa pedido mínimo de R$ 25; a demonstração permite pedidos menores para facilitar os testes e não deve ser usada para receber vendas reais.
7. Conectar pagamentos e WhatsApp somente após autorização específica. Não há cobrança, envio de mensagens, chatbot de IA ou impressão fiscal nesta entrega.

## Variáveis

Para a demonstração, apenas `VITE_DEMO_MODE=true` em `.env`. `DEMO_DATA_DIR` é uma opção de servidor para mudar o diretório de persistência. `PORT` muda a porta de `npm start`. Não use o adaptador de arquivos em hospedagem pública.

O legado Supabase usa `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` e `SUPABASE_SERVICE_ROLE_KEY` no servidor, conforme `src/integrations/supabase/client.server.ts`. Verifique os nomes no arquivo antes de configurar o futuro adaptador. Nunca prefixe service role com `VITE_`. As chaves do ZIP original não são distribuídas no novo ZIP.

## Limitações explícitas

- A logomarca tipográfica inicial é uma proposta provisória; pode ser substituída em Minha loja. A ilustração do hero é SVG original.
- O sorvete de frutas vermelhas não tinha foto no material: usa ilustração com o aviso “Foto a cadastrar”.
- Banana, granola e leite em pó são opções fictícias gratuitas, marcadas no modal. O sabor obrigatório dos picolés e seus 19 sabores vêm do ZIP. Preços, fotos e descrições do catálogo vêm do material fornecido.
- Taxa de R$ 5 e cupom LABOR10 são fictícios e estão identificados. Promoções importadas não tinham período: confirme sua validade.
- Uploads locais aceitam PNG/JPG/WebP de até 700 KB e ficam no arquivo de dados. Storage e galeria completa ficam para a integração de produção.
- Cupons têm um exemplo funcional; não há editor de campanhas/cupons completo. O assistente local responde apenas às opções apresentadas com dados do catálogo.
- Fontes Google são opcionais, com fallback local. Sem internet o restante da demonstração funciona com os assets locais.
- A RLS preparada, Supabase remoto, pagamentos e integrações externas não foram validados nesta entrega.
