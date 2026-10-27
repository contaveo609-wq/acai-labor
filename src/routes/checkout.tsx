import { useState } from "react";
import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { SiteShell } from "@/components/SiteShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { itemTotal, useCart } from "@/lib/cart";
import { useSession } from "@/lib/auth";
import { fetchStoreSettings, formatBRL, PAYMENT_LABEL } from "@/lib/menu";
import { placeGuestOrder, placeUserOrder } from "@/lib/orders.functions";
import { DEMO_MODE } from "@/lib/demo";
import { LaborCheckout } from "@/components/LaborCheckout";

export const Route = createFileRoute("/checkout")({
  head: () =>
    DEMO_MODE
      ? {
          meta: [
            { title: "Finalizar pedido — Açaí Labor" },
            {
              name: "description",
              content: "Finalize seu pedido da Açaí Labor.",
            },
            { name: "robots", content: "noindex, nofollow" },
          ],
        }
      : {
          meta: [
            {
              title: DEMO_MODE
                ? "Finalizar pedido — Açaí Labor"
                : "Finalizar pedido — Skina do Frango & Assados",
            },
            {
              name: "description",
              content: "Informe seu endereço e forma de pagamento para concluir o pedido.",
            },
            { property: "og:title", content: "Finalizar pedido — Skina do Frango & Assados" },
            {
              property: "og:description",
              content: "Entrega no Jardim Primavera e região, Rondonópolis/MT.",
            },
            { property: "og:type", content: "website" },
            { name: "twitter:card", content: "summary" },
          ],
        },
  component: Checkout,
});

function Checkout() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  if (pathname !== "/checkout") return <Outlet />;
  if (DEMO_MODE) return <LaborCheckout />;
  return <OriginalCheckout />;
}
function OriginalCheckout() {
  const { items, subtotal, clear } = useCart();
  const { data: store } = useQuery({ queryKey: ["store"], queryFn: fetchStoreSettings });
  const { user } = useSession();
  const navigate = useNavigate();
  const guestOrder = useServerFn(placeGuestOrder);
  const userOrder = useServerFn(placeUserOrder);
  const [busy, setBusy] = useState(false);
  const [payment, setPayment] = useState<"pix" | "cartao" | "dinheiro">("pix");
  const [form, setForm] = useState({
    customer_name: "",
    customer_phone: "",
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    reference: "",
    change_for: "",
    notes: "",
  });

  const fee = Number(store?.delivery_fee ?? 0);
  const total = subtotal + fee;

  function set(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (items.length === 0) {
      toast.error("Seu carrinho está vazio.");
      return;
    }
    setBusy(true);
    const payload = {
      customer_name: form.customer_name.trim(),
      customer_phone: form.customer_phone.trim(),
      street: form.street.trim(),
      number: form.number.trim(),
      complement: form.complement.trim() || null,
      neighborhood: form.neighborhood.trim(),
      reference: form.reference.trim() || null,
      payment_method: payment,
      change_for: payment === "dinheiro" && form.change_for ? Number(form.change_for) : null,
      notes: form.notes.trim() || null,
      items: items.map((i) => ({
        product_id: i.productId,
        quantity: i.quantity,
        notes: i.notes || null,
        addons: i.addons.map((a) => ({ addon_id: a.id, quantity: a.quantity })),
      })),
    };

    try {
      const result = user
        ? await userOrder({ data: payload })
        : await guestOrder({ data: payload });
      clear();
      toast.success(`Pedido #${result.order_number} enviado!`);
      navigate({ to: "/pedido/$id", params: { id: result.id } });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível enviar o pedido. Tente novamente.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <SiteShell>
      <form onSubmit={submit} className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="font-display text-4xl">Finalizar pedido</h1>

        <section className="mt-5 space-y-3 rounded-2xl border border-border bg-card p-4">
          <h2 className="font-display text-2xl">Seus dados</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Nome completo"
              required
              value={form.customer_name}
              onChange={(v) => set("customer_name", v)}
            />
            <Field
              label="WhatsApp / telefone"
              required
              value={form.customer_phone}
              onChange={(v) => set("customer_phone", v)}
              placeholder="(66) 90000-0000"
            />
          </div>
        </section>

        <section className="mt-4 space-y-3 rounded-2xl border border-border bg-card p-4">
          <h2 className="font-display text-2xl">Endereço de entrega</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Rua" required value={form.street} onChange={(v) => set("street", v)} />
            <Field label="Número" required value={form.number} onChange={(v) => set("number", v)} />
            <Field
              label="Bairro"
              required
              value={form.neighborhood}
              onChange={(v) => set("neighborhood", v)}
            />
            <Field
              label="Complemento"
              value={form.complement}
              onChange={(v) => set("complement", v)}
            />
          </div>
          <Field
            label="Ponto de referência"
            value={form.reference}
            onChange={(v) => set("reference", v)}
          />
        </section>

        <section className="mt-4 space-y-3 rounded-2xl border border-border bg-card p-4">
          <h2 className="font-display text-2xl">Pagamento</h2>
          <p className="text-xs text-muted-foreground">
            O pagamento é feito na entrega. Pagamento online será disponibilizado em breve.
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            {(["pix", "cartao", "dinheiro"] as const).map((method) => (
              <button
                key={method}
                type="button"
                onClick={() => setPayment(method)}
                className={`rounded-xl border px-3 py-3 text-sm font-semibold transition-colors ${
                  payment === method
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background"
                }`}
              >
                {PAYMENT_LABEL[method]}
              </button>
            ))}
          </div>
          {payment === "dinheiro" ? (
            <Field
              label="Troco para quanto?"
              value={form.change_for}
              onChange={(v) => set("change_for", v.replace(/[^\d.]/g, ""))}
              placeholder="Ex.: 100"
            />
          ) : null}
          <div>
            <Label htmlFor="obs-pedido">Observações do pedido</Label>
            <Textarea
              id="obs-pedido"
              maxLength={500}
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              className="mt-1"
            />
          </div>
        </section>

        <section className="mt-4 rounded-2xl border border-border bg-card p-4">
          <h2 className="font-display text-2xl">Resumo</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {items.map((i) => (
              <li key={i.key} className="flex justify-between gap-3">
                <span>
                  {i.quantity}x {i.name}
                </span>
                <span>{formatBRL(itemTotal(i))}</span>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex justify-between text-sm">
            <span>Taxa de entrega</span>
            <span>{fee > 0 ? formatBRL(fee) : "A combinar"}</span>
          </div>
          <div className="mt-2 flex justify-between border-t border-border pt-2 font-display text-2xl">
            <span>Total</span>
            <span className="text-primary">{formatBRL(total)}</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Entrega estimada: {store?.delivery_time_min ?? 40}–{store?.delivery_time_max ?? 57}{" "}
            minutos.
          </p>
          <Button
            type="submit"
            disabled={busy || items.length === 0}
            className="mt-4 h-12 w-full rounded-full font-display text-2xl tracking-wide"
          >
            {busy ? "Enviando..." : "Confirmar pedido"}
          </Button>
        </section>
      </form>
    </SiteShell>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
}) {
  const id = label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div>
      <Label htmlFor={id}>
        {label}
        {required ? " *" : ""}
      </Label>
      <Input
        id={id}
        value={value}
        required={required ?? false}
        placeholder={placeholder ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1"
      />
    </div>
  );
}
