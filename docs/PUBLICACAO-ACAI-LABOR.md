# Publicação da Açaí Labor

O código aceita um único processo Node com armazenamento persistente. A publicação ainda não foi realizada. Não use hospedagem que descarte `.local/labor` entre reinícios ou que execute várias réplicas contra a mesma pasta.

## Antes de publicar

1. Defina um domínio HTTPS próprio. Configure o proxy reverso para encaminhar o `Host` e protocolo HTTPS corretos, bloquear acesso direto à porta Node e renovar o certificado TLS. Defina `LABOR_PUBLIC_BASE_URL=https://dominio-da-loja` sem barra final. O servidor recusa outros domínios e HTTP.
2. Defina `VITE_DEMO_MODE=true` na compilação, `LABOR_ENCRYPT_DATA=1` no processo e uma pasta persistente em `DEMO_DATA_DIR`. No Windows, o cofre usa DPAPI e o serviço deve rodar sempre sob o mesmo usuário. Em Linux, defina `LABOR_SECRET_KEY` com 32 bytes aleatórios em base64, fora do código e do repositório. Faça backup cifrado da pasta e guarde a chave em cofre separado.
3. Defina `LABOR_VAPID_SUBJECT=mailto:contato@seu-dominio` com um contato real. Não regenere as chaves VAPID depois que os aparelhos se inscreverem. Instale o PWA no aparelho da loja e clique em **Receber pedidos neste aparelho** no topo do painel. Cada novo pedido envia um push com os itens. O botão exige permissão explícita do navegador.
4. Cadastre o App Secret da Meta em **WhatsApp e Segurança**. Configure na Meta o webhook `https://dominio-da-loja/api/webhook/whatsapp` e o Verify Token guardado no painel. Assine o campo `messages`, teste recebimento e resposta com um número autorizado. O webhook de outro aplicativo não serve para esta instalação.
5. Cadastre autenticador em **WhatsApp e Segurança** e guarde códigos de recuperação. Após ativado, cada novo login exige senha e código. Teste recuperação antes de remover o único aparelho autenticador.
6. Escolha e configure um gateway de pagamento antes de aceitar pedidos reais. Hoje o checkout registra apenas testes e não captura Pix/cartão. Atualize textos e regras comerciais antes de abrir a loja ao público.

O servidor envia cabeçalhos de proteção, exige HTTPS no domínio público, marca cookies seguros e cifra dados/segredos em repouso. Páginas e imagens públicas permanecem legíveis pelo navegador; TLS protege o tráfego. Dados já gravados em texto simples antes da migração podem persistir em snapshots externos ou blocos antigos de disco. Verifique e descarte backups antigos conforme sua política.

Push pode falhar quando o aparelho nega permissão, está offline, expira a inscrição ou o serviço do navegador está indisponível. O painel aberto mantém alerta visual/sonoro. Não substitua operação humana por uma promessa de entrega de push.

O teste da chave Gemini fez três chamadas, abaixo das cinco autorizadas. A chave ficou no cofre; não habilite IA pública com essa chave de teste. O teto interno configurável de 1.500 chamadas/dia não altera a cota do Google.

Recursos identificados na [lista pública da Brendi](https://brendi.com.br/planos) e na [página do sistema](https://brendi.com.br/sistema-para-restaurantes): cardápio, pedidos, WhatsApp/IA, CRM, campanhas, recuperação, fidelidade, cashback, cupons, relatórios, estoque por produto/embalagem, entregadores e impressão manual por setor estão presentes localmente. Caixa, salão/mesas, tráfego pago automático, PDV e integrações externas ainda requerem implementação e homologação. Conexões com iFood e 99Food ficam excluídas pelo pedido do proprietário. Recursos internos não públicos da Brendi não são verificáveis por essas páginas.
