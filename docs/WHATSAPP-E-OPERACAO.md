# Açaí Labor — WhatsApp e operação local

Atualização de 17/10/2026. O catálogo e os pedidos existentes foram preservados. O painel permanece com a identidade Açaí Labor.

## Validação real feita

A consulta autenticada à Meta confirmou que o Phone Number ID informado pertence à WABA informada. A conta retornou o número de teste. Os templates foram sincronizados pela API oficial e a Meta retornou um identificador `wamid` para o envio único do template aprovado `hello_world` ao destinatário expressamente autorizado pelo proprietário. O registro está na fila do painel como **accepted**. Isso confirma aceitação pela Meta, não entrega ou leitura.

Access Token e Verify Token estão no cofre local cifrado com Windows DPAPI, vinculado ao usuário do Windows. O conteúdo não é retornado ao navegador, incluído nos arquivos de dados ou registrado em logs. Não há credenciais no código-fonte. Os scripts específicos do teste real foram removidos após execução.

O recebimento real permanece desativado: falta App Secret e uma URL HTTPS que encaminhe a rota deste servidor. O endereço fornecido do Skinadofrango é de outra aplicação; não foi alterado nem tratado como se executasse este checkout. A configuração local não faz publicação automática no Lovable.

## Como terminar a configuração da Meta

1. Abra `/admin/whatsapp`. Cadastre um autenticador na seção Segurança usando sua senha administrativa atual. Guarde os códigos de recuperação.
2. No painel do aplicativo da Meta, localize o App Secret em Configurações do app/Básico. Informe-o no campo protegido **App Secret**, sem enviá-lo pelo chat.
3. Salve as credenciais. Isso desativa a integração até novo teste, evitando continuar com uma combinação de credenciais não validada.
4. Teste a conexão. Para ensaio com servidor local, use uma URL HTTPS que encaminhe **somente** `/api/webhook/whatsapp` por um túnel com restrição de caminho. Para publicação completa, use domínio HTTPS da própria Açaí Labor e `LABOR_PUBLIC_BASE_URL`.
5. Cadastre essa URL e o mesmo Verify Token na Meta e assine o campo `messages` da WABA. O painel registrará a data do desafio e do primeiro evento validado.
6. Ative a integração e as respostas automáticas. Para Gemini, consulte modelos, teste o modelo e habilite separadamente **Gemini no WhatsApp** em `/admin/chatbot`.
7. Envie uma mensagem do telefone autorizado de teste. Confirme entrada na Central, resposta no aparelho, transferência humana e eventos de entrega/leitura.

A versão `v24.0` foi aceita pela API no teste desta conta. Não é apresentada como a versão mais recente. O campo pode ser atualizado quando a conta exigir outra versão.

## Funcionalidades conectadas

- **WhatsApp oficial:** webhook GET de verificação; HMAC-SHA256 obrigatório nos POST; limite de corpo; associação WABA/telefone; janela temporal de eventos; deduplicação; persistência antes do ACK; filas de entrada/saída; backoff para recusas 429; falha ambígua marcada para conferência sem reenvio cego; recibos monotônicos de envio/entrega/leitura.
- **Atendimento:** site e WhatsApp na mesma central, contatos e canal, histórico, busca, assumir/reativar/encerrar, resposta humana, templates aprovados e indicadores. A versão da conversa invalida respostas automáticas ainda na fila quando o humano assume. Uma requisição já iniciada na Meta não pode ser recolhida.
- **IA:** mesma consulta de catálogo, preços, disponibilidade, promoções e pedidos autorizados; últimas cinco mensagens e resumo estruturado; limite diário e por conversa; nome, saudação, tom, emoji, horário da loja, expressões proibidas e transferência por dúvida desconhecida. O modelo classifica intenção; o servidor controla valores e ações.
- **Mídias:** download administrativo e envio humano de JPG/PNG, OGG/MP3 e PDF, até 8 MB. Recebimento multimodal também admite formatos de áudio aceitos pelo adaptador. Downloads só partem dos domínios oficiais permitidos, sem redirects. Figurinhas e mídia incompatível recebem encaminhamento humano. O caminho multimodal está implementado, mas sua qualidade depende de homologação com o modelo e os arquivos reais; não houve teste real de áudio/imagem com Gemini nesta sessão.
- **Pedidos WhatsApp:** atendente prepara itens, quantidades, adicionais, endereço e pagamento. O mesmo backend do checkout calcula a proposta. Cliente responde `CONFIRMAR código`, válido por uma hora. Preços e disponibilidade são revalidados. A criação é idempotente e aparece em Pedidos com origem WhatsApp. A proposta anterior é cancelada quando outra é enviada.
- **CRM:** histórico de pedidos e atendimentos, total efetivamente pago, ticket, favoritos comprovados, etiquetas, notas, origem e trilha de consentimento. Segmentos por critérios configuráveis. A agregação de CRM por telefone é administrativa e não concede ao chatbot acesso a pedidos de outras sessões.
- **Campanhas:** rascunho, segmento, filtros por compras, gasto, etiquetas e produto favorito, prévia personalizada, público elegível, agendamento, confirmação com MFA, pausa, frequência mínima e opt-out. Consentimento, público e aprovação são conferidos novamente no despacho. Sem custos ou conversões inventados.
- **Recuperação:** cliente salva o carrinho voluntariamente no checkout e confirma o código `VINCULAR` no WhatsApp do mesmo telefone. Só então o consentimento fica verificado. Um lembrete por carrinho, com template aprovado sem parâmetros, intervalo configurável, frequência e opt-out. Compra concluída cancela lembretes ainda na fila.
- **Fidelidade:** pontos e cashback configuráveis para compras reais pagas elegíveis, expiração, histórico por lote, resgate no balcão com MFA e idempotência, estorno no cancelamento/reembolso. Resgates de valores posteriormente estornados reduzem crédito futuro; o saldo disponível nunca fica negativo. Pedidos locais de teste não geram crédito real.
- **Cupons:** percentual, valor fixo, frete grátis, validade, mínimo, produtos elegíveis, limite total e por sessão, primeiro pedido, recorrência e inatividade. Todas as restrições são verificadas no backend sob a mesma fila de escrita da criação do pedido. No checkout anônimo, regras “por cliente” usam a sessão do navegador, não uma identidade civil verificada.
- **Operação:** central de notificações com leitura persistente; PWA instalável; push de um aviso por novo pedido com lista dos produtos para cada aparelho autorizado; avisos sonoros enquanto o painel está aberto; lembrete interno de pagamento; encerramento de conversas automáticas inativas; avisos de status para pedidos WhatsApp autorizados dentro da janela de 24 horas; histórico e deduplicação das automações. A entrega de push depende da permissão, do navegador e do serviço push do aparelho.
- **Impressão:** manual, resumida/detalhada, filtro por categoria/setor, endereço, observações, origem e situação financeira. Não há promessa de impressão silenciosa.
- **Relatórios e integrações:** métricas dos registros disponíveis, receita real separada de testes, tokens reportados, falhas e resultados de campanhas. Cartões indicam integrações pendentes e conduzem à configuração.

## Limites explícitos da instalação

O aplicativo continua **local e de demonstração** para pedidos e pagamentos. Não gera cobrança online nem muda pagamento para aprovado. O recebimento financeiro exige gateway e confirmação verificável do provedor; conclusão operacional de pedido não confirma pagamento.

A nova chave Gemini de teste passou na consulta real de modelos e no teste de classificação com `gemini-3.5-flash-lite`: 3 chamadas à API Google no total, dentro do máximo de 5 autorizado. A chave está no cofre local cifrado. A IA externa não foi ativada para clientes com uma chave limitada a testes. O atendimento determinístico do catálogo e a transferência humana funcionam sem Gemini. O teto de 1.500 requisições por dia é controle interno; a cota real é definida pelo Google por projeto e modelo.

O adaptador de arquivos aceita um processo por pasta. `LABOR_STORE_ID` e `DEMO_DATA_DIR` isolam catálogo, pedidos, credenciais e sessões por instalação; uma pasta já identificada recusa outro estabelecimento. Não há ainda cadastro de equipes com vários papéis nem visão consolidada de lojas neste adaptador. Não execute várias instâncias escrevendo na mesma pasta. Supabase/RLS legado não foi aplicado a uma conta remota.

Push em segundo plano está implementado; cada aparelho da loja deve autorizar notificações no painel. A entrega real com o site fechado exige publicação HTTPS e inscrição de um aparelho; não foi homologada com aparelho real nesta sessão. Estoque quantitativo por produto/embalagem já reserva na compra, alerta ao limite e devolve ao cancelar. Entregadores podem ser cadastrados e atribuídos a pedidos prontos, com resumo de valores por entrega e diária. Impressão silenciosa, Meta Pixel/Conversions API, Analytics/Tag Manager e gateway permanecem dependentes de implementação ou credenciais. Coexistência com o aplicativo WhatsApp Business não foi homologada para o número informado.

Clientes, campanhas e históricos podem conter dados pessoais. A pasta `.local` é privada e deve permanecer fora de ZIPs, publicação e versionamento. Não publique a instalação local como backend comercial sem adequar armazenamento, identidade de usuários, operação contínua e política de retenção.

## Testes

Validação ampliada: login com segundo fator, migração cifrada, inscrição push, domínio HTTPS e fluxos de navegador. Execute os comandos abaixo após cada alteração. Cardápio e painel seguem em `http://127.0.0.1:5173` no modo local.

`npm run typecheck`, `npm test`, `npm run build` e `npm run test:ui`. Testes usam diretórios e credenciais fictícias isolados. Os testes de interface usam Edge e uma porta temporária; não alteram o cadastro administrativo real nem enviam mensagens reais.

Cobertura inclui webhook legítimo/inválido, duplicatas, replay, eventos fora de ordem, conta errada, janela de 24 horas, indisponibilidade, backoff, envio incerto, humano interrompendo IA, templates, consentimento, pausa, opt-out, mídias, TOTP, recuperação de conta, isolamento, cupons, fidelidade e pedidos WhatsApp. A homologação real de entrada/entrega/leitura depende do webhook acima.

## Referências

- [Coleção oficial da Meta para WhatsApp](https://www.postman.com/meta/whatsapp-business-platform/overview).
- [Referência oficial de payloads de webhook](https://www.postman.com/meta/whatsapp-business-platform/folder/tduohwq/webhook-payload-reference).
- [Templates oficiais](https://www.postman.com/meta/whatsapp-business-platform/request/lwtlz1k/send-message-template-interactive).
- [RFC 6238 — TOTP](https://www.rfc-editor.org/rfc/rfc6238).
