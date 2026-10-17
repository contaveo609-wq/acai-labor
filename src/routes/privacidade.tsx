import { createFileRoute } from "@tanstack/react-router";
import { SiteShell } from "@/components/SiteShell";
import { DEMO_MODE } from "@/lib/demo";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      {
        title: DEMO_MODE
          ? "Privacidade — Açaí Labor"
          : "Política de privacidade — Skina do Frango & Assados",
      },
      { name: "description", content: "Como a loja utiliza os dados de pedidos e atendimento." },
      {
        property: "og:title",
        content: DEMO_MODE
          ? "Privacidade — Açaí Labor"
          : "Política de privacidade — Skina do Frango & Assados",
      },
      { property: "og:description", content: "Transparência no uso dos seus dados pessoais." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Privacidade,
});

function Privacidade() {
  if (DEMO_MODE)
    return (
      <SiteShell>
        <article className="mx-auto max-w-2xl space-y-4 px-4 py-10 text-sm leading-relaxed text-muted-foreground">
          <h1 className="font-display text-4xl text-foreground">Privacidade na Açaí Labor</h1>
          <p>
            Esta versão funciona localmente como demonstração. Pedidos, conversas e configurações
            ficam no servidor local. O checkout não realiza cobranças online.
          </p>
          <p>
            Nome, telefone, endereço e itens do pedido são usados no atendimento e na operação da
            loja. Um cookie identifica este navegador para restringir o acesso aos seus pedidos e
            conversas. O painel exige a senha do administrador.
          </p>
          <p>
            As mensagens do chat podem ser vistas pelo responsável da loja. O acesso à conversa
            expira depois de 30 dias sem atividade; registros expirados são removidos quando uma
            conversa é aberta novamente no sistema.
          </p>
          <p>
            Quando o responsável ativa Gemini, as últimas cinco mensagens relevantes e um resumo de
            produtos e quantidade são enviados ao Google para interpretar sua solicitação. Não envie
            documentos, senhas ou dados de cartão no chat. Preços, disponibilidade e permissões são
            validados pelo servidor da loja.
          </p>
          <p>
            Esta versão não ativa campanhas promocionais nem compartilha conversas para publicidade.
            Para solicitar revisão ou remoção dos dados locais, use “Solicitar atendente” e informe
            o pedido ou conversa ao responsável.
          </p>
        </article>
      </SiteShell>
    );
  return (
    <SiteShell>
      <article className="mx-auto max-w-2xl space-y-4 px-4 py-10 text-sm leading-relaxed text-muted-foreground">
        <h1 className="font-display text-4xl text-foreground">Política de privacidade</h1>
        <p>
          Coletamos apenas os dados necessários para preparar e entregar seu pedido: nome, telefone
          de contato, endereço de entrega e o histórico de pedidos feitos na plataforma.
        </p>
        <p>
          Esses dados são usados exclusivamente para atendimento, entrega e suporte. Não vendemos
          nem compartilhamos suas informações com terceiros para fins publicitários.
        </p>
        <p>
          O acesso ao histórico de pedidos é protegido por autenticação, e cada cliente visualiza
          somente os próprios dados.
        </p>
        <p>
          Para solicitar correção ou exclusão dos seus dados, fale conosco pelo WhatsApp +55 66
          8105-5779.
        </p>
      </article>
    </SiteShell>
  );
}
