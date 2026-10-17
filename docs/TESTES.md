# Verificação da entrega

> Registro da V1. Para a evolução Vendrex V2, consulte `V2-TESTES.md`.

## Resultados

- Node.js 24.16.0 / Windows.
- `npm run typecheck`: aprovado, sem erros de TypeScript.
- `npm test`: 16 testes aprovados, 0 falhas.
- `npm ci --dry-run --ignore-scripts --no-audit --no-fund`: aprovado; package.json e lockfile sincronizados.
- `npm run build`: aprovado com saída Node/Nitro.
- Build iniciado em 127.0.0.1:5174 e página inicial confirmada com HTTP 200.
- Prévia de desenvolvimento também respondeu HTTP 200.

## Testes automatizados

1. Importação: 12 produtos únicos, preços dos copos e 19 sabores de picolés.
2. Bloqueio de leitura/gravação administrativa sem sessão válida.
3. Validação da senha no servidor, hash persistido e bloqueio de redefinição indevida pelo setup.
4. Recalculo do total, centavos, desconto e entrega sem confiar no preço enviado pelo cliente.
5. Idempotência em duas confirmações concorrentes.
6. Privacidade: um visitante não lê o pedido de outro.
7. Mínimos, máximos e duplicidade dos adicionais.
8. Rejeição de adicional pertencente a outro produto.
9. Registro de pedido com sabor obrigatório de picolé.
10. Bloqueio de produto esgotado.
11. Adicional pago calculado pelo servidor.
12. Bloqueio de loja fechada e categoria desativada.
13. Validação de telefone, endereço, quantidade, cupom e troco.
14. Exigência de nova revisão quando o total mudou.
15. Mudança de status administrativa, retirada sem etapa de entrega e bloqueio de reabertura de pedido encerrado.
16. Persistência após recriar o serviço, renovação de login e logout.

Os testes usam diretório temporário dentro de `work/`, sem tocar em banco remoto. O diretório é removido após as verificações com o caminho validado.

## Fluxo verificado pelo navegador

- Abriu copo de 500 ml, escolheu banana, quantidade 2 e observação.
- Adicionou ao carrinho, abriu a edição e incluiu granola.
- Checkout preenchido com nome, telefone e endereço fictícios.
- Aplicou LABOR10: subtotal R$ 19,98, desconto R$ 2,00, entrega demonstrativa R$ 5,00, total R$ 22,98.
- Revisou e confirmou. Pedido de teste #1001 registrado e carrinho limpo.
- Painel exigiu senha; login testado com conta temporária local, removida antes da entrega para o usuário definir sua própria senha.
- Pedido #1001 apareceu no painel; status alterado para Em preparação.
- Preço promocional do copo alterado para R$ 8,99 pela interface e confirmado na tabela. Valor original R$ 9,99 restaurado.
- A página do cliente exibiu Em preparação no build de produção, lendo o mesmo pedido persistido.
- Layout observado em desktop e celular; quebra do título/preços em tela estreita corrigida. Após estabilizar o viewport móvel, largura do documento igual à largura disponível (375 px), sem conteúdo alargando a página.
- Capturas reais: `previa-desktop.png` e `previa-mobile.png`, na pasta de outputs acima do projeto.

## Limites da verificação

Não foram executados testes em Supabase remoto, banco PostgreSQL, produção pública, pagamentos, WhatsApp, autenticação remota ou todas as telas legadas. A migração multiloja é preparação não aplicada. Uploads de imagem e cada variação de formulário não foram exercitados individualmente pelo navegador.

O build mantém avisos de APIs antigas do TanStack no código legado. O projeto já utilizava essas APIs; os novos endpoints usam a API `validator`. Não foi feita atualização geral do framework.

Durante checagens simultâneas o Windows reportou limite de memória ao abrir um processo PowerShell adicional. Os comandos de typecheck, testes e validação do lockfile concluíram com sucesso; os servidores temporários foram encerrados e o build final foi executado separadamente. Nenhuma configuração do Windows foi alterada.
