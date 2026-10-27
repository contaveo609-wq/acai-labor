import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { SiteShell } from "@/components/SiteShell";
import { Button } from "@/components/ui/button";
import { laborDeclarePix, laborGetOrder } from "@/lib/labor.functions";
import { formatBRL } from "@/lib/menu";
import { LABOR_PIX_KEY, pixCode } from "@/lib/pix";

export const Route = createFileRoute("/checkout/$id")({
  head: () => ({
    meta: [
      { title: "Pagamento Pix — Açaí Labor" },
      { name: "description", content: "Finalize o pagamento Pix do seu pedido." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: PixCheckoutPage,
});

function PixCheckoutPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [image, setImage] = useState("");
  const [busy, setBusy] = useState(false);
  const { data: order, isLoading } = useQuery({
    queryKey: ["pix-checkout", id],
    queryFn: () => laborGetOrder({ data: { id } }),
    refetchOnWindowFocus: true,
  });
  const code = order?.payment_method === "pix" ? pixCode(order) : "";

  useEffect(() => {
    if (!code) return;
    let active = true;
    import("qrcode")
      .then(({ default: QRCode }) => QRCode.toDataURL(code, { width: 300, margin: 2 }))
      .then((url) => {
        if (active) setImage(url);
      })
      .catch(() => {
        if (active) setImage("");
      });
    return () => {
      active = false;
    };
  }, [code]);

  if (isLoading)
    return (
      <SiteShell>
        <p className="p-10 text-center text-muted-foreground">Preparando seu Pix…</p>
      </SiteShell>
    );

  if (!order || order.payment_method !== "pix")
    return (
      <SiteShell>
        <div className="p-10 text-center">
          <p>Pagamento Pix não encontrado.</p>
          <Link to="/" className="mt-4 inline-block text-primary underline">
            Voltar ao início
          </Link>
        </div>
      </SiteShell>
    );

  if (["em_analise", "pago"].includes(String(order.payment_status)))
    return (
      <SiteShell>
        <div className="mx-auto max-w-xl px-5 py-16 text-center">
          <h1 className="font-display text-3xl">Pagamento já informado</h1>
          <p className="mt-3 text-muted-foreground">
            Continue no acompanhamento do pedido #{order.order_number}.
          </p>
          <Link
            to="/pedido/$id"
            params={{ id: order.id }}
            className="mt-6 inline-flex rounded-full bg-primary px-5 py-3 font-semibold text-primary-foreground"
          >
            Acompanhar pedido
          </Link>
        </div>
      </SiteShell>
    );

  return (
    <SiteShell>
      <main className="mx-auto max-w-xl px-5 py-8">
        <div className="rounded-2xl border bg-card p-5 text-center">
          <p className="text-sm text-muted-foreground">Pedido #{order.order_number}</p>
          <h1 className="font-display text-3xl mt-2">Pague com Pix</h1>
          <p className="mt-2 text-lg">
            Total: <strong className="text-primary">{formatBRL(order.total)}</strong>
          </p>
          <p className="mt-3 font-semibold text-destructive">
            Demonstração: não faça transferência real.
          </p>
          {image && (
            <img
              src={image}
              width={300}
              height={300}
              alt="QR Code Pix do pedido"
              className="mx-auto my-5 rounded-xl bg-white p-2"
            />
          )}
          <p className="text-sm text-muted-foreground">
            Abra o aplicativo do banco, escolha Pix e leia o QR Code. Confira o destinatário antes
            de confirmar.
          </p>
          <p className="mt-3 text-xs">Chave CNPJ: {LABOR_PIX_KEY}</p>
          <code
            className="mt-3 block break-all rounded-xl bg-muted p-3 text-left text-xs"
            aria-label="Código Pix copia e cola"
          >
            {code}
          </code>
          <Button
            type="button"
            variant="outline"
            className="mt-4 w-full"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(code);
                toast.success("Código Pix copiado.");
              } catch {
                toast.error("Selecione e copie o código acima.");
              }
            }}
          >
            Copiar código Pix
          </Button>
          <Button
            type="button"
            className="mt-3 h-12 w-full"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await laborDeclarePix({ data: { id: order.id } });
                toast.success("Pagamento informado. Seu pedido será analisado.");
                navigate({ to: "/pedido/$id", params: { id: order.id } });
              } catch (error) {
                toast.error(
                  error instanceof Error ? error.message : "Não foi possível informar o pagamento.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Enviando para análise…" : "Já fiz o pagamento"}
          </Button>
          <p className="mt-3 text-xs text-muted-foreground">
            Este botão não aprova o Pix. A loja fará a conferência manual no Itaú.
          </p>
        </div>
      </main>
    </SiteShell>
  );
}
