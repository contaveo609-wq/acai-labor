# Skina Delivery Hub

Crie uma plataforma completa de pedidos online para a empresa SKINA DO FRANGO & ASSADOS, inspirada na experiência de navegação, organização e fluxo de pedidos de plataformas modernas como o Brendi (pedido.brendi.com.br), porém com identidade visual, layout, componentes e código próprios.

IMPORTANTE:
O arquivo ZIP anexado contém a logomarca, imagens dos produtos, categorias, nomes, descrições, pesos, porções e preços da empresa.

ANTES DE DESENVOLVER:

Analise todo o arquivo ZIP anexado.

Use a logomarca real fornecida.

Extraia e utilize as imagens reais dos produtos.

Leia os arquivos .txt presentes nas pastas para identificar corretamente:

nome dos produtos;

descrição;

preço;

peso;

quantidade;

pessoas que serve;

adicionais;

categorias.

Não invente produtos ou preços quando essas informações estiverem disponíveis no arquivo.

Evite duplicar produtos que aparecem em mais de uma pasta, utilizando o mesmo produto em diferentes categorias/áreas quando necessário.

==================================================

IDENTIDADE VISUAL
==================================================

A identidade visual deve ser baseada diretamente na logomarca fornecida.

Paleta principal:

Vermelho intenso da logomarca como cor dominante.

Amarelo/dourado da logomarca para destaques, preços, CTAs e elementos de atenção.

Branco para textos sobre fundos escuros/vermelhos.

Tons neutros de cinza/preto para equilíbrio visual.

Não utilize uma paleta genérica de restaurante.

Extraia visualmente as cores da própria logomarca e mantenha consistência entre:

botões;

cabeçalho;

categorias;

cards;

preços;

badges;

promoções;

checkout;

chatbot;

painel administrativo.

A logo deve aparecer com boa resolução e proporção correta.

==================================================
2. OBJETIVO DO SITE

O site será uma loja virtual de pedidos para delivery, permitindo que o cliente:

veja o cardápio;

navegue por categorias;

pesquise produtos;

veja fotos;

veja descrição;

veja preço;

escolha quantidade;

escolha adicionais;

escreva observações;

adicione produtos ao carrinho;

informe endereço;

escolha forma de pagamento;

acompanhe o resumo do pedido;

finalize o pedido.

A experiência deve ser extremamente simples e rápida, principalmente no celular.

O público deve conseguir fazer um pedido sem precisar aprender como o sistema funciona.

==================================================
3. INFORMAÇÕES DA EMPRESA

Nome:
SKINA DO FRANGO & ASSADOS

Localização de atendimento:
Jardim Primavera — Rondonópolis/MT

Tempo estimado de entrega:
40–57 minutos

Mostrar essa informação de maneira visível na experiência de pedido.

Exemplo:

"Entrega estimada: 40–57 min"

Não apresentar tempo de entrega como garantia absoluta.

==================================================
4. HOME / CARDÁPIO

Criar uma página inicial moderna, responsiva e focada em conversão.

No topo:

logo;

localização/endereço;

status da loja;

estimativa de entrega;

botão do carrinho;

acesso/login.

Criar uma seção de destaque apresentando:

"Skina do Frango & Assados"

e uma mensagem convidando o cliente a fazer seu pedido.

Adicionar:

"Entrega estimada: 40–57 min"

Criar barra de pesquisa:

"Buscar no cardápio..."

Criar navegação horizontal ou em abas pelas categorias.

As categorias devem ser derivadas do arquivo fornecido.

Categorias identificadas no material incluem:

Mais Pedidos

Frangos Assados

Acompanhamentos & Extras

Combos & Almoços Completos

Bebidas Geladas

Carnes na Brasa

Se existirem outras categorias no arquivo, também devem ser incluídas.

==================================================
5. PRODUTOS

Criar cards de produtos visualmente atraentes.

Cada card deve apresentar:

foto real do produto;

nome;

descrição curta;

preço;

indicação de produto mais pedido quando aplicável;

indicação de promoção quando aplicável;

status "Esgotado" quando o administrador marcar;

botão "+" para adicionar rapidamente.

Ao clicar no produto, abrir uma janela/modal detalhada.

==================================================
6. PÁGINA/MODAL DO PRODUTO

Mostrar:

imagem grande;

nome;

descrição completa;

peso;

quantidade;

número de pessoas que serve;

preço;

quantidade;

adicionais;

observações;

botão "Adicionar ao carrinho".

Para produtos que possuem complementos, permitir seleção de adicionais.

Exemplo:

"Complete seu almoço"

Permitir escolher acompanhamentos quando configurados pelo administrador.

Mostrar preço adicional de cada complemento.

Permitir regras como:

mínimo de opções;

máximo de opções;

opções obrigatórias;

opções opcionais.

Essas regras devem ser configuráveis no painel administrativo.

==================================================
7. PRODUTOS MAIS PEDIDOS

Criar uma seção de destaque:

"🔥 Mais pedidos"

Utilizar os produtos presentes na pasta "Mais Pedidos" do arquivo.

Também permitir que o administrador defina manualmente quais produtos aparecem nessa seção.

O administrador deve conseguir:

adicionar produto aos mais pedidos;

remover produto dos mais pedidos;

alterar ordem dos produtos.

==================================================
8. PROMOÇÕES

Criar sistema de promoções.

O administrador poderá:

criar promoção;

escolher produto;

definir preço promocional;

definir desconto percentual;

definir data de início;

definir data de término;

ativar/desativar promoção;

criar badge "PROMOÇÃO";

destacar produto na home.

Mostrar claramente preço original e preço promocional quando aplicável.

==================================================
9. CARRINHO

Criar carrinho lateral ou página de carrinho.

Mostrar:

produtos;

quantidade;

adicionais;

observações;

preço individual;

subtotal;

taxa de entrega;

desconto;

total.

Permitir:

aumentar quantidade;

diminuir quantidade;

remover produto;

editar produto;

voltar ao cardápio.

CTA principal:

"Finalizar pedido"

==================================================
10. CHECKOUT

Criar checkout em etapas simples.

ETAPA 1 — Identificação

nome;

telefone.

ETAPA 2 — Entrega

endereço;

número;

complemento;

bairro;

referência.

Como a empresa atende Jardim Primavera/Rondonópolis, criar estrutura preparada para validação de área de entrega.

ETAPA 3 — Pagamento

Criar suporte preparado para:

Pix;

cartão;

dinheiro.

Se houver necessidade de integração real de pagamento, deixar a arquitetura preparada para integração futura.

ETAPA 4 — CONFIRMAÇÃO

Mostrar:

resumo completo;

endereço;

forma de pagamento;

tempo estimado de entrega;

valor total.

Botão:

"Confirmar pedido"

==================================================
11. PEDIDO

Criar sistema de pedidos com status:

Recebido;

Confirmado;

Em preparação;

Saiu para entrega;

Entregue;

Cancelado.

O cliente poderá visualizar o status do pedido.

Criar número/ID único para cada pedido.

==================================================
12. CHATBOT / ATENDENTE VIRTUAL

Criar um chatbot moderno integrado ao site.

Nome sugerido:

"Atendente Virtual Skina"

O chatbot deve funcionar como um atendente de restaurante.

Ele deve conseguir responder perguntas como:

Quais produtos vocês têm?

Quanto custa a costela?

O que acompanha esse combo?

Quanto tempo demora a entrega?

Onde vocês entregam?

Quais bebidas têm?

Quais são os mais pedidos?

Quais acompanhamentos existem?

Qual o preço de determinado produto?

Como faço um pedido?

Quero pedir uma costela.

Quero um combo para 4 pessoas.

Quero adicionar arroz.

Qual produto serve mais pessoas?

O chatbot deve consultar os dados reais cadastrados no sistema.

REGRA CRÍTICA:

O chatbot NUNCA deve inventar preço, produto, disponibilidade, promoção, prazo ou informação comercial.

Quando não souber responder, não deve inventar.

Nesse caso responder:

"Não tenho essa informação no momento. Vou encaminhar você para nosso atendimento no WhatsApp."

E disponibilizar botão:

"Falar com atendente no WhatsApp"

WhatsApp oficial:

+55 66 8105-5779

Criar link funcional para iniciar conversa no WhatsApp.

==================================================
13. CHATBOT AJUDANDO A MONTAR O PEDIDO

Além de responder dúvidas, o chatbot deve ajudar o cliente a montar o pedido.

Exemplo:

Cliente:
"Quero comida para 4 pessoas."

Bot:
"Posso ajudar. Temos combos que atendem aproximadamente 4 pessoas. Quer ver nossas opções?"

O chatbot pode apresentar produtos disponíveis.

Cliente:
"Quero o combo de costela."

Bot:
"Perfeito. Você gostaria de adicionar algum acompanhamento ou bebida?"

Permitir que o chatbot interaja com o carrinho quando tecnicamente possível.

IMPORTANTE:
Antes de confirmar um pedido, o sistema deve mostrar o resumo para o cliente confirmar.

==================================================
14. LOGIN

Criar sistema de autenticação.

Tela de login moderna.

Permitir:

criar conta;

entrar;

recuperar senha;

manter sessão.

Criar dois níveis de acesso:

CLIENTE

ADMINISTRADOR

O cliente terá acesso a:

seus dados;

pedidos;

pedidos anteriores;

status dos pedidos;

endereços salvos;

favoritos, se implementado.

==================================================
15. PAINEL ADMINISTRATIVO

Criar área:

"/admin"

Protegida por autenticação e autorização.

Somente administradores podem acessar.

Dashboard inicial mostrando:

faturamento;

pedidos hoje;

pedidos da semana;

pedidos do mês;

ticket médio;

produtos mais vendidos;

pedidos em andamento;

pedidos concluídos;

pedidos cancelados.

Criar gráficos simples e profissionais.

Permitir filtros:

hoje;

últimos 7 dias;

mês;

período personalizado.

==================================================
16. GERENCIAMENTO DE PRODUTOS

O administrador poderá:

adicionar produto;

editar produto;

excluir produto;

ativar produto;

desativar produto;

marcar como esgotado;

alterar preço;

alterar nome;

alterar descrição;

alterar peso;

alterar quantidade;

alterar pessoas que serve;

alterar categoria;

alterar foto;

adicionar várias fotos;

definir produto como "Mais Pedido";

definir promoção;

ordenar produtos.

Criar interface intuitiva.

==================================================
17. GERENCIAMENTO DE CATEGORIAS

Administrador poderá:

criar categoria;

editar categoria;

excluir categoria;

alterar ordem;

ativar/desativar categoria.

Exemplo:

🔥 Combos & Almoços Completos

🥩 Carnes na Brasa

🍗 Frangos Assados

🍚 Acompanhamentos & Extras

🥤 Bebidas Geladas

==================================================
18. PRODUTO ESGOTADO

Quando administrador marcar um produto como esgotado:

produto continua visível;

mostrar claramente "ESGOTADO";

impedir adição ao carrinho;

não permitir compra;

chatbot deve reconhecer que o produto está indisponível.

Quando o administrador reativar:

produto volta automaticamente a permitir pedidos.

==================================================
19. FOTOS

Utilizar as imagens reais presentes no ZIP.

Criar sistema para o administrador:

trocar imagem;

remover imagem;

adicionar imagem;

definir imagem principal.

O frontend deve utilizar otimização de imagens para carregamento rápido.

==================================================
20. EDITOR DA PÁGINA

Criar uma área no painel administrativo chamada:

"Editar página"

Permitir editar:

nome da empresa;

descrição;

logo;

banner;

textos;

informações de entrega;

horário;

telefone;

WhatsApp;

categorias;

produtos em destaque;

promoções;

cores quando necessário.

Não permitir que alterações administrativas quebrem o layout.

==================================================
21. PEDIDOS NO ADMIN

Criar página:

"Pedidos"

Mostrar pedidos em formato de lista e/ou Kanban.

Colunas:

NOVOS
↓
CONFIRMADOS
↓
EM PREPARAÇÃO
↓
SAIU PARA ENTREGA
↓
ENTREGUES

Cada pedido deve mostrar:

número;

cliente;

telefone;

produtos;

quantidade;

adicionais;

observações;

endereço;

pagamento;

total;

horário;

status.

Permitir alterar status rapidamente.

==================================================
22. DASHBOARD FINANCEIRO

Criar dashboard com:

faturamento bruto;

quantidade de pedidos;

ticket médio;

produto mais vendido;

categoria mais vendida;

faturamento por período;

vendas por produto;

vendas por categoria.

Gráficos responsivos.

Não inventar dados.

Se o banco ainda estiver vazio, mostrar estados vazios profissionais.

==================================================
23. BANCO DE DADOS

Criar arquitetura real para persistência dos dados.

Entidades principais:

users
profiles
products
categories
product_images
product_addons
promotions
orders
order_items
order_item_addons
addresses
store_settings
chatbot_settings

Criar relacionamentos corretamente.

Implementar autenticação e autorização.

Administradores devem possuir permissões diferentes dos clientes.

Nunca confiar somente em proteção do frontend para permissões administrativas.

As regras de acesso devem existir também no backend/database.

==================================================
24. DESIGN RESPONSIVO

Prioridade:

MOBILE FIRST.

O site será muito utilizado por celular.

No desktop:

layout centralizado;

boa largura;

cards organizados;

painel administrativo completo.

No celular:

navegação simples;

botões grandes;

carrinho acessível;

categorias com scroll horizontal;

checkout rápido;

chatbot acessível;

imagens sem quebrar layout.

==================================================
25. EXPERIÊNCIA VISUAL

A interface deve transmitir:

restaurante brasileiro;

comida saborosa;

confiança;

rapidez;

qualidade;

profissionalismo.

Não criar aparência genérica de template.

Utilizar a logomarca como referência visual.

Cards com fotos grandes e apetitosas.

Preços com excelente legibilidade.

CTAs claros.

Criar microinterações discretas.

==================================================
26. HEADER

Desktop:

LOGO | CATEGORIAS | BUSCAR | LOGIN | CARRINHO

Mobile:

LOGO | BUSCA | CARRINHO

Criar header sticky quando apropriado.

==================================================
27. RODAPÉ

Mostrar:

SKINA DO FRANGO & ASSADOS

Jardim Primavera — Rondonópolis/MT

Entrega estimada: 40–57 min

WhatsApp:
+55 66 8105-5779

Links:

Cardápio

Meus pedidos

Login

Fale conosco

Política de privacidade

Termos de uso

==================================================
28. WHATSAPP

Criar botão flutuante do WhatsApp.

Número:

+55 66 8105-5779

Ao clicar, abrir conversa no WhatsApp.

Também utilizar esse número como fallback do chatbot.

Se o chatbot não conseguir responder uma pergunta, encaminhar para o WhatsApp.

==================================================
29. ARQUITETURA DO CHATBOT

O chatbot deve utilizar os dados estruturados do banco.

Criar uma camada de conhecimento baseada em:

produtos;

preços;

categorias;

disponibilidade;

promoções;

horários;

área de entrega;

tempo estimado;

informações da empresa.

Implementar mecanismo de fallback.

Fluxo:

PERGUNTA DO CLIENTE
↓
CHATBOT PROCURA INFORMAÇÃO
↓
INFORMAÇÃO ENCONTRADA?
↓
SIM → RESPONDE
↓
NÃO → EXPLICA QUE NÃO SABE
↓
OFERECE WHATSAPP
↓
+55 66 8105-5779

Nunca fabricar informações.

==================================================
30. SEO

O site deve possuir:

title:

"Skina do Frango & Assados | Rondonópolis"

Meta description relacionada a frangos assados, carnes na brasa, combos e delivery em Jardim Primavera, Rondonópolis.

URLs amigáveis.

Boa estrutura semântica.

==================================================
31. PERFORMANCE

O site precisa carregar rapidamente.

Utilizar:

lazy loading;

compressão/otimização de imagens;

componentes reutilizáveis;

carregamento eficiente dos produtos;

cache quando apropriado.

Não carregar todas as imagens em resolução desnecessariamente alta.

==================================================
32. SEGURANÇA

Implementar:

autenticação segura;

autorização por função;

proteção de rotas;

validação de dados;

proteção de operações administrativas;

regras de acesso ao banco;

proteção contra manipulação de preços pelo cliente.

O preço final do pedido deve ser validado pelo backend/database, não confiado ao frontend.

==================================================
33. ESTRUTURA DE NAVEGAÇÃO

Criar:

/

/cardapio

/produto/:id

/carrinho

/checkout

/pedido/:id

/login

/cadastro

/minha-conta

/meus-pedidos

/admin

/admin/dashboard

/admin/pedidos

/admin/produtos

/admin/categorias

/admin/promocoes

/admin/clientes

/admin/configuracoes

/admin/editor

==================================================
34. PRODUTOS DO ARQUIVO

Utilize exatamente os produtos encontrados no arquivo fornecido.

Alguns produtos identificados no material incluem:

🔥 Costela no Bafo 8 Horas – Desmanchando
Preço a partir de R$ 80,00
1,2 kg
Serve 3 pessoas

🔥 Combo Costela no Bafo 8h + Acompanhamentos
Preço a partir de R$ 120,00
1,2 kg
Serve 4 pessoas

🔥 Super Combo Família – Costela + Acompanhamentos + Coca 2L
Preço a partir de R$ 174,00
Serve 5 pessoas

🥩 Capa do Contra-Filé na Brasa – 1kg
Preço a partir de R$ 70,00
Serve 3 pessoas

🥩 Fraldinha Premium na Brasa
Preço a partir de R$ 90,00
1 kg
Serve 3 pessoas

🥩 Combo Capa do Contra-Filé + Acompanhamentos
Preço a partir de R$ 109,50
Serve 4 pessoas

🥩 Combo Fraldinha Premium + Acompanhamentos
Preço a partir de R$ 129,99
1 kg
Serve 4 pessoas

🍚 Arroz Branco – 500g
R$ 10,00

🥔 Maionese Cremosa com Hellmann's – 250g
R$ 12,00

🍌 Farofa de Banana da Casa – 250g
R$ 10,00

🥗 Vinagrete Fresquinho da Casa – 250g
R$ 8,00

🥔 Batatinhas Bolinha Assadas – 10 un.
R$ 10,00

⭐ Kit Acompanhamentos da Família – 1,25kg
R$ 39,90

🥤 Coca-Cola 2L Gelada
R$ 14,00

🥤 Coca-Cola Zero 2L Gelada
R$ 14,00

🥤 Fanta 2L Gelada
R$ 14,00

🥤 Guaraná Antarctica 2L Gelado
R$ 14,00

🍺 Cerveja Lata Gelada
R$ 6,00

Linguiça Assada na Brasa
R$ 3,50

IMPORTANTE:
Essa lista é apenas uma referência inicial baseada no arquivo. O sistema deve analisar o ZIP completo e cadastrar todos os produtos encontrados, respeitando os dados dos arquivos.

==================================================
35. ADMINISTRADOR — EXPERIÊNCIA

O painel administrativo deve parecer um sistema profissional de gestão de restaurante.

Sidebar:

Dashboard
Pedidos
Produtos
Categorias
Promoções
Mais pedidos
Clientes
Editor da página
Configurações
Chatbot
Sair

Dashboard com indicadores.

Produtos com tabela/grid.

Editor visual simples.

Pedidos com atualização de status.

==================================================
36. CONFIGURAÇÕES DO CHATBOT

No painel administrativo permitir:

ativar/desativar chatbot;

editar nome do atendente;

editar mensagem inicial;

editar mensagem de fallback;

editar WhatsApp;

adicionar perguntas frequentes;

adicionar respostas;

controlar quais informações o chatbot pode responder.

==================================================
37. ESTADO INICIAL

Ao abrir o site pela primeira vez:

utilizar os produtos do ZIP;

utilizar as fotos reais;

utilizar a logo real;

criar categorias;

criar produtos;

configurar a estimativa de entrega;

configurar WhatsApp;

criar área administrativa;

criar autenticação.

Não criar dados falsos de vendas para o dashboard.

O dashboard deve começar com zero vendas/pedidos e preencher os dados conforme os pedidos reais forem registrados.

==================================================
38. IMPORTANTE SOBRE O RESULTADO FINAL

Quero um sistema funcional, não apenas uma landing page.

O projeto precisa possuir:

frontend completo;

backend;

banco de dados;

autenticação;

painel administrativo;

gerenciamento de produtos;

gerenciamento de categorias;

promoções;

pedidos;

carrinho;

checkout;

chatbot;

integração/fallback para WhatsApp;

responsividade;

persistência dos dados.

Não criar apenas telas estáticas ou botões falsos.

Todos os principais fluxos devem funcionar.

==================================================
39. PRIORIDADE DE DESENVOLVIMENTO

Priorize nesta ordem:

Estrutura do banco de dados

Autenticação

Produtos e categorias

Cardápio

Carrinho

Checkout

Pedidos

Painel administrativo

Promoções

Dashboard

Chatbot

Editor da página

Refinamento visual

Performance e segurança

==================================================
40. RESULTADO ESPERADO

O resultado final deve parecer uma plataforma profissional de delivery própria da Skina do Frango & Assados, com experiência semelhante à de grandes sistemas de pedidos online.

A prioridade é:

COMIDA → PRODUTO → CARRINHO → CHECKOUT → PEDIDO

O cliente deve conseguir abrir o site, encontrar rapidamente o que deseja e finalizar o pedido com o mínimo de fricção possível.

Use o arquivo ZIP anexado como fonte principal para a identidade visual, imagens e catálogo,depois resolvemos sobre o pagamento online.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/005acc0e-5580-4421-869e-1d9c2e1d64e2).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
