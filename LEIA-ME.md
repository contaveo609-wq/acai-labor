# Açaí Labor — catálogo e pedidos locais

Cardápio, carrinho, checkout, pedidos e administração para Açaí Labor. Execução local, sem cobrança real. Produtos, pedidos e senha administrativa anteriores preservados.

## Rodar no Windows

1. Use Node.js 24 ou superior.
2. Extraia o ZIP em uma pasta.
3. Execute `INICIAR.bat`. Ele instala as dependências se necessário, compila e inicia o servidor.
4. Abra [a loja](http://127.0.0.1:5173/) ou [o painel](http://127.0.0.1:5173/admin).
5. Mantenha o terminal aberto; Ctrl+C encerra o servidor.

No painel, use a senha que já cadastrou. Em uma extração nova, defina uma senha de pelo menos 12 caracteres. Não há senha universal.

Pelo terminal:

```powershell
Copy-Item .env.example .env
npm ci
npm run build
npm start
```

Copie o arquivo de ambiente somente em uma instalação nova. Para editar com recarga automática: `npm run dev`. O modo compilado (`npm start`) usa o último build; após editar, gere novamente.

## Configurar a loja

- **Minha loja:** nome, logo, cores, título/descrição/imagem principal, contato, endereço, taxa, mínimo e horários. Agendamento e modalidades podem ser ativados separadamente. Horários em Brasília; fechamento manual suspende novos pedidos.
- **Produtos:** categorias, fotos, preços, promoções, SKU, publicação/esgotado, grupos de opções e unidades/embalagens. Unidade base e embalagens têm regras de quantidade próprias. kg/litro aceitam frações.
- **Pedidos:** busca, filtros, avanço das etapas, cancelamento com motivo, notas internas, histórico e impressão.
- **Auditoria:** registro de alterações com autor e data. O ambiente local tem um proprietário; perfis adicionais completos ficam para evolução posterior.

O catálogo inicial é importado da página pública `pedido.brendi.com.br/acai-labor`: 122 produtos únicos em 17 categorias no momento da importação. Preços, descrições e imagens seguem a fonte pública quando disponíveis; cinco produtos não tinham descrição e três não tinham imagem publicada. O script `npm run import:catalog` continua reservado para o material ZIP anterior; para atualizar a fonte pública use `node scripts/import-brendi-catalog.mjs --write-seed --apply-local`.

## Dados e segurança local

Dados em `.local/labor/database-secret.json`, cifrados com Windows DPAPI no `npm start`; hash da senha em `.local/labor/admin.json`. O primeiro início migra automaticamente o antigo `data.json`. Não apague esses arquivos para atualizar. Faça backup da pasta `.local` com o servidor parado. Sessões expiram em 8 horas e exigem novo login após reinício. O modo local atende somente em loopback, com um processo.

A migração local acrescenta campos sem excluir pedidos/produtos. Pagamentos antigos ficam pendentes, inclusive em pedidos entregues. A marca padrão é Açaí Labor; nomes personalizados são mantidos.

Checkout ainda não cobra Pix ou cartão; o provedor será escolhido depois. WhatsApp oficial e Gemini têm configurações próprias no painel. A chave Gemini de teste ficou cifrada e foi validada sem ativar atendimento externo para clientes. Não cadastre dados de cartão ou credenciais nos produtos/observações.

## Verificar

```powershell
npm run typecheck
npm test
npm run build
npm run test:ui
```

Os testes de domínio/RLS usam uma massa V1 temporária, separada do catálogo público importado. O teste de interface usa Edge instalado, servidor temporário em uma porta livre e uma conta administrativa exclusiva do teste. Ele fecha os processos que abriu e remove somente seu diretório temporário. A pasta real `.local` não é usada nos testes.

## Escopo e próximos passos

Esta é a Fase 1 local. Ainda não é uma implantação comercial completa. Pagamentos/caixa, estoque físico/logística, Gemini/atendimento, fidelidade/marketing e PDV fazem parte das próximas fases. Consulte [diagnóstico e plano](docs/V2-AUDITORIA-E-PLANO.md), [entrega e limitações](docs/V2-ENTREGA.md), [testes](docs/V2-TESTES.md) e [produção](docs/PRODUCAO.md).

A migração SQL da Fase 1 foi testada em PostgreSQL embarcado com RLS. Ela não foi aplicada a um Supabase real e ainda não conecta a interface ao banco remoto. Não aplique todo o histórico SQL legado automaticamente.

A arquitetura React/TypeScript/TanStack/Nitro e os arquivos de referência foram preservados. O ZIP V1 anterior permanece separado.
