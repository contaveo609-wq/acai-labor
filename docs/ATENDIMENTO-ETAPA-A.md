# Açaí Labor — atendimento do site

Implementação incremental da etapa A do complemento recebido em 17/10/2026. A identidade continua Açaí Labor. O catálogo, checkout, pedidos e acesso administrativo anteriores foram preservados.

## Implementado

- Chat flutuante responsivo, histórico persistente, horários das mensagens, estado de consulta, erros, retomada e saudação configurável.
- Consulta de produtos publicados, descrições, disponibilidade e promoções vigentes. Preços são calculados no servidor, usando as mesmas regras do checkout.
- Sugestões de carrinho com confirmação pelo cliente. Antes de adicionar, o servidor verifica a origem da sugestão, a sessão, o produto, o preço atual, a quantidade e as opções obrigatórias. Produtos que exigem personalização remetem ao cardápio. O checkout continua revalidando o pedido completo.
- Consulta de pedidos restrita ao cookie do visitante que realizou a compra. A resposta não contém endereço, telefone, notas internas ou identificadores de autenticação.
- Central de Atendimento em `/admin/atendimento`, com busca no histórico, filtro por estado, assumir, responder, reativar e encerrar. Mensagens do site aparecem no painel e respostas humanas aparecem no site. Atualização por consulta a cada três segundos enquanto a tela está aberta.
- Solicitar atendente funciona durante uma consulta ao Gemini. Um contador de versão invalida respostas pendentes quando o humano assume, a configuração muda ou a conversa é encerrada. Reativar o automático não reaproveita uma resposta antiga.
- Mensagens identificadas por UUID e deduplicadas. Reutilizar o mesmo identificador com outro texto é rejeitado. Uma conversa não inicia duas consultas ao modelo ao mesmo tempo.
- Configuração em `/admin/chatbot`: nome, saudação, ativação, limites administrativos, API key, consulta de modelos disponíveis e teste de geração. Gemini só pode ser ativado depois de um teste bem-sucedido para o modelo selecionado.
- Chave armazenada com Windows DPAPI, vinculada ao usuário do sistema operacional. Em outros sistemas, o cofre exige `LABOR_SECRET_KEY`, chave externa de 32 bytes em base64, e usa AES-256-GCM. A chave mestra não é criada junto ao arquivo de dados. O painel só recebe a presença da chave, nunca seu conteúdo. `GEMINI_API_KEY` no ambiente é alternativa; uma chave salva no cofre tem precedência.
- Adaptador REST do Gemini com timeout de 20 segundos, chave em cabeçalho, paginação de modelos e DTO explícito. Respostas brutas de erro do provedor não são retornadas nem registradas.
- Gemini classifica intenções em uma estrutura validada. O servidor apresenta dados comerciais e decide quais operações são permitidas; o modelo não escreve respostas comerciais livres, altera preços ou confirma pagamentos.
- Contexto limitado às cinco últimas mensagens não sistêmicas, mais um resumo controlado de IDs de produtos, quantidade e intenção. Nenhum histórico de outro visitante é incluído. Não são enviados segredos, dados administrativos ou todo o banco de pedidos.
- Limite de dez mensagens por minuto, duzentas mensagens por conversa, mil conversas retidas e limites administrativos diário (UTC) e por conversa. Requisições são reservadas sob a mesma fila de escrita, antes da chamada externa. Erros e descarte de respostas são contabilizados.
- Acesso ao histórico expira após trinta dias sem atividade. A remoção física das conversas expiradas ocorre na próxima abertura de chat; não há serviço independente de expurgo em segundo plano nesta etapa.

## Como usar localmente

1. Abra a loja em `http://127.0.0.1:5173/` e use “Ajuda com o catálogo”. Consultas ao catálogo e atendimento humano funcionam sem Gemini.
2. Entre no painel com a senha que você cadastrou. Em “Central de Atendimento”, selecione a conversa e escolha “Assumir atendimento” antes de responder.
3. Para habilitar Gemini, abra “Inteligência Artificial”, guarde sua chave, consulte os modelos da sua conta, selecione um modelo e teste. Depois marque “Ativar Gemini no site” e salve as preferências. Não envie a chave por mensagens ou a inclua em arquivos compartilhados.

Foi encontrada uma chave Gemini no ambiente do servidor. Uma consulta real de modelos retornou HTTP 400; nenhuma geração real foi concluída e a IA permanece desativada. Substitua a chave no painel e valide o modelo antes de ativar. O teste de geração no painel pode consumir cota e gerar custo conforme a conta. Os limites reais da conta são desconhecidos; o limite administrativo não é uma promessa de cota gratuita. Tokens são contados quando retornados pelo provedor, sem estimativa inventada de custo.

## Verificação

- `npm run typecheck` e `npm run build`: aprovados.
- `npm test`: 48 testes aprovados, incluindo 13 cenários novos de atendimento, além das verificações anteriores de catálogo, checkout, autenticação e RLS.
- `npm run test:ui`: 9 fluxos aprovados, incluindo conversa persistente, catálogo, inclusão no carrinho, abertura das opções do produto, atendimento humano entre duas sessões, configuração de saudação e chat no smartphone.
- Corrigido um seletor CSS que ampliava o ícone de adicionar em produtos sem foto. O catálogo real passou a ocupar 390 px em uma tela de 390 px, mantendo o botão do chat dentro da tela.
- Verificado que a chave Gemini do ambiente não está presente nos arquivos JavaScript enviados ao navegador.
- Testes usam diretórios temporários, credenciais fictícias e respostas do Gemini simuladas. Não usam o banco local do usuário nem enviam mensagens externas ou cobranças.

## Atualização posterior

Este documento registra a etapa A. WhatsApp, CRM, campanhas, recuperação, fidelidade, MFA e operação local foram acrescentados posteriormente. Consulte [o estado atual e as dependências de homologação](WHATSAPP-E-OPERACAO.md).

## Referências técnicas consultadas

- Google: [Models API](https://ai.google.dev/api/models).
- Google: [Structured outputs em generateContent](https://ai.google.dev/gemini-api/docs/generate-content/structured-output?hl=en).

O formato estruturado é validado novamente no servidor. Respeitar o schema não torna uma decisão do modelo automaticamente autorizada.
