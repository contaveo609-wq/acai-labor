# Verificação — Vendrex V2, Fase 1

Data: 17/10/2026. Windows, Node 24, build Node/Nitro. Testes usam dados fictícios e temporários; não modificam a pasta `.local` da loja nem serviços externos.

## Resultados

- `npm run typecheck`: aprovado.
- `npm test`: 35 testes aprovados, zero falhas (16 regressões V1, 13 casos V2, 6 grupos SQL/RLS).
- `npm run build`: aprovado.
- `npm run test:ui`: 8 fluxos aprovados em Edge headless, zero erros JavaScript não tratados capturados. Teste móvel em viewport 390 × 844, sem rolagem horizontal do documento.
- O hash do arquivo da senha administrativa existente foi comparado com o backup anterior à alteração e permanece igual.

## Domínio e segurança

Cobertos: catálogo importado, autenticação/senha/hash/sessão, preços calculados no servidor, desconto/centavos, adicionais obrigatórios/máximos/duplicados/de outro produto, indisponibilidade, categoria/loja fechadas, dados do checkout, troco, preço desatualizado, persistência e logout.

V2: migração aditiva, embalagem com preço próprio, mínimo/incrementos, kg fracionado, mínimo após desconto e sem frete, horários de Brasília/virada do dia, agendamento e modalidades desativadas, 12 confirmações simultâneas com a mesma chave, rejeição de chave reutilizada com conteúdo diferente, transições/concorrência por estado esperado, separação financeiro/operação, cancelamento justificado, notas privadas, integridade dos cadastros, tentativas paralelas de login e falha de gravação.

## PostgreSQL e RLS

As migrações isoladas de 16/10 e 17/10 foram executadas no motor PostgreSQL do PGlite. O teste cria duas lojas, dois administradores e um cliente, com papéis `anon` e `authenticated` e uma implementação de teste de `auth.uid()`.

Verificados: catálogo público ativo; negação de pedidos anônimos; leitura de pedidos por loja/proprietário; impossibilidade de alterar preço de outra loja; FK composta bloqueando categoria de outra loja; impossibilidade de autopromoção; impossibilidade de editar valores ou status financeiro diretamente; RPC verificando papel/loja/transição/estado esperado; auditoria automática e protegida de alteração pelos papéis de navegador; isolamento do histórico.

Esses testes não validam o serviço remoto Supabase, emissão/verificação real de JWT, PostgREST, rede ou políticas de Storage. Não houve aplicação de migrações em banco externo.

## Interface

1. Página inicial, catálogo e filtro por formato de venda.
2. Embalagem de teste: fardo a R$ 50, quantidade mínima 2, banana, observação com texto `<script>`, carrinho preservado após recarregar, retirada, débito presencial e cupom LABOR10. Total R$ 90, pagamento pendente. O texto HTML não executou JavaScript.
3. Outro navegador/visitante não acessa o pedido sabendo seu UUID.
4. Painel protegido, definição de senha temporária exclusiva do teste, edição/persistência do SKU.
5. Nota privada, preparação do comprovante de teste e chamada de impressão, avanço para Em preparação e atualização no acompanhamento do cliente. A nota não aparece ao cliente. Nenhuma impressora física foi acionada.
6. Pedido mínimo e agendamento configurados e preservados ao recarregar; evento de auditoria visível.
7. Catálogo e personalização no celular emulado; checkout bloqueado abaixo do mínimo; largura do documento validada.
8. Webhook externo retorna 503 no modo local.

Capturas: `../vendrex-validacao/desktop.png`, `mobile.png`, `admin.png`. Resultado estruturado em `resultado.json`, gerado novamente pelo teste. O fardo QA e o cliente fictício existem somente no diretório temporário, removido ao final; não entram no catálogo entregue.

## Falhas encontradas e corrigidas durante a validação

- Teste inicial buscava “500ml”, enquanto o título usa “500 ml”. A busca agora ignora espaços e pesquisa também SKU/slug; os seletores de teste usam o texto visível.
- Contraste baixo no botão do carrinho após aplicar a nova cor: corrigido e revisto em desktop/celular.
- Divergência de hidratação React ao abrir a loja depois de alterar o pedido mínimo: faltava compartilhar o cache de configuração entre servidor e navegador. O root carrega a configuração antes de renderizar e o roteador serializa apenas consultas públicas bem-sucedidas. Mutações, sessões e snapshots administrativos são excluídos do HTML. O teste que reproduziu o erro passou após a correção.
- O TypeScript detectou acesso inalcançável a uma chave opcional no bloco legado desativado. O bloco de gravação insegura foi removido, mantendo a rejeição explícita.

## Não testado / fases seguintes

Pagamentos aprovados/recusados, webhooks financeiros falsos/duplicados, reembolso, conciliação, insuficiência/concorrência de estoque físico, conexão real Supabase/Gemini, quotas de IA, WhatsApp ponta a ponta, RBAC de cinco perfis, MFA, carga de produção e aparelhos físicos. Esses recursos não são declarados funcionais nesta fase. Os testes de concorrência exercitam o serviço de arquivos em um processo, não uma implantação distribuída.

Não foi feita uma auditoria exaustiva de dependências, validação legal/LGPD, testes de todas as telas legadas ou certificação de segurança. Uploads novos de logo/banner/foto têm limites/formatos validados, mas todas as combinações de arquivo não foram exercitadas na interface.
