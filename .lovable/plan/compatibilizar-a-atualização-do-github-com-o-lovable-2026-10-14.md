# Compatibilizar a atualização do GitHub com o Lovable

## Objetivo
Manter as funcionalidades e dados trazidos pela atualização, corrigindo somente incompatibilidades com o ambiente Lovable e TanStack Start.

## Alterações
1. Ajustar as versões obrigatórias do TanStack para as versões seguras suportadas pelo Lovable.
2. Corrigir o endpoint de WhatsApp para o formato atual de rotas do TanStack Start, preservando a URL e o comportamento.
3. Alinhar os tipos do banco com as consultas existentes sem remover as novas tabelas da atualização.
4. Corrigir retornos e acessos que não são serializáveis no ambiente publicado.
5. Manter chaves privadas apenas no servidor e preservar as variáveis públicas necessárias ao navegador.
6. Validar compilação, página inicial, produtos, categorias e ausência de erros no navegador.

## Limites
- Sem redesenho ou criação de funcionalidades.
- Sem alteração destrutiva no banco ou nos dados.
- Sem trocar a conexão de banco configurada pelo usuário.
