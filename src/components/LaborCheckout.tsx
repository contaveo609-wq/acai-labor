import { useState, useRef } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ShoppingBag, Truck, Store, ArrowLeft, Check } from "lucide-react";
import { SiteShell } from "./SiteShell";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { useCart } from "@/lib/cart";
import { laborCatalog, laborPlaceOrder, laborVisitor, laborTrackCart } from "@/lib/labor.functions";
import { lineCents, validateFulfillment } from "@/lib/vendrex.rules";
import { effectivePrice, formatBRL, PAYMENT_LABEL } from "@/lib/menu";
import type { LaborOrderInput } from "@/lib/labor.schema";
import { couponDiscount } from "@/lib/coupons";
export function LaborCheckout() {
  const { items, clear } = useCart();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const requestId = useRef(crypto.randomUUID());
  const submitting = useRef(false);
  const { data: catalog } = useQuery({
    queryKey: ["labor-checkout-catalog"],
    queryFn: async () => {
      await laborVisitor();
      return laborCatalog();
    },
    staleTime: 0,
  });
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState(false);
  const [fulfillment, setFulfillment] = useState<"delivery" | "pickup">("delivery");
  const [payment, setPayment] = useState<LaborOrderInput["payment_method"]>("pix");
  const [scheduled, setScheduled] = useState("");
  const [coupon, setCoupon] = useState("");
  const [applied, setApplied] = useState("");
  const [recovery, setRecovery] = useState<{
    code: string;
    verified: boolean;
    businessPhone: string;
  } | null>(null);
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
  const set = (k: keyof typeof form, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setReview(false);
  };
  const lines = items.map((item) => {
    const p = catalog?.products.find((p) => p.id === item.productId);
    const options = p?.addon_groups.flatMap((g) => g.product_addons) || [];
    const unit = p
      ? item.saleOptionId
        ? (p.sale_options?.find((o) => o.id === item.saleOptionId && o.is_active)?.price ??
          item.unitPrice)
        : effectivePrice(p)
      : item.unitPrice;
    const addons = item.addons.reduce(
      (s, a) =>
        s + Math.round((options.find((o) => o.id === a.id)?.price ?? a.price) * 100) * a.quantity,
      0,
    );
    return { ...item, total: lineCents(Math.round(unit * 100) + addons, item.quantity) / 100 };
  });
  const subtotal = lines.reduce((s, l) => s + Math.round(l.total * 100), 0) / 100;
  const validCoupon = catalog?.coupons.find(
    (c) => c.code === applied && c.is_active && subtotal >= c.min_total,
  );
  const fee = fulfillment === "delivery" ? catalog?.store.delivery_fee || 0 : 0;
  const discount = validCoupon
    ? couponDiscount(
        validCoupon,
        lines.map((l) => ({ product_id: l.productId, line_total: l.total })),
        fee,
      ) / 100
    : 0;
  const total = Math.round((subtotal - discount + fee) * 100) / 100;
  const belowMinimum =
    subtotal - (validCoupon?.kind === "shipping" ? 0 : discount) <
    (catalog?.store.minimum_order || 0);
  const addressFields = [
    ["street", "Rua"],
    ["number", "Número"],
    ["neighborhood", "Bairro"],
    ["complement", "Complemento"],
    ["reference", "Ponto de referência"],
  ] as const;
  async function confirm() {
    if (!catalog?.ordering_enabled) {
      toast.error("Pedidos indisponíveis nesta prévia.");
      return;
    }
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    try {
      const data: LaborOrderInput = {
        ...form,
        fulfillment,
        scheduled_for: scheduled ? `${scheduled}:00-03:00` : null,
        payment_method: payment,
        change_for:
          payment === "dinheiro" && form.change_for
            ? Number(form.change_for.replace(",", "."))
            : null,
        coupon: applied,
        expected_total: total,
        attribution: (await import("@/lib/ads.tracking")).campaignOrigin(),
        request_id: requestId.current,
        items: items.map((i) => ({
          product_id: i.productId,
          sale_option_id: i.saleOptionId || null,
          quantity: i.quantity,
          notes: i.notes,
          addons: i.addons.map((a) => ({ addon_id: a.id, quantity: a.quantity })),
        })),
      };
      const result = await laborPlaceOrder({ data });
      clear();
      toast.success(`Pedido #${result.order_number} registrado.`);
      navigate({
        to: payment === "pix" ? "/checkout/$id" : "/pedido/$id",
        params: { id: result.id },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível registrar o pedido.");
      setReview(false);
      await qc.invalidateQueries({ queryKey: ["labor-checkout-catalog"] });
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  if (!items.length)
    return (
      <SiteShell>
        <div className="mx-auto max-w-xl px-5 py-16 text-center">
          <ShoppingBag className="mx-auto mb-5 text-primary" size={36} />
          <h1 className="text-3xl">Seu próximo favorito está esperando.</h1>
          <Link className="inline-block mt-6 text-primary underline" to="/cardapio">
            Escolher no cardápio
          </Link>
        </div>
      </SiteShell>
    );
  return (
    <SiteShell>
      <div className="mx-auto max-w-4xl px-5 py-8">
        {catalog && !catalog.ordering_enabled && (
          <div
            role="status"
            className="mb-6 rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm"
          >
            Prévia de demonstração. Pedidos ainda não estão disponíveis neste endereço.
          </div>
        )}
        <Link
          to="/carrinho"
          className="inline-flex gap-2 items-center text-xs text-muted-foreground"
        >
          <ArrowLeft size={14} /> Voltar ao carrinho
        </Link>
        <h1 className="font-display text-4xl mt-5">Seu pedido, quase pronto.</h1>
        <p className="checkout-demo-notice">
          Pedido de teste · nenhum pagamento ou entrega real será realizado. Taxa demonstrativa de{" "}
          {formatBRL(catalog?.store.delivery_fee || 0)}.
        </p>
        <div className="grid gap-5 md:grid-cols-[1.2fr_1fr]">
          <form
            id="labor-checkout"
            onSubmit={(e) => {
              e.preventDefault();
              if (!catalog) return;
              try {
                validateFulfillment(
                  catalog.store,
                  fulfillment,
                  scheduled ? `${scheduled}:00-03:00` : null,
                );
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Revise o atendimento.");
                return;
              }
              if (belowMinimum) {
                toast.error("O pedido está abaixo do mínimo da loja.");
                return;
              }
              if (!/^\d{10,13}$/.test(form.customer_phone.replace(/\D/g, ""))) {
                toast.error("Informe um telefone válido com DDD.");
                return;
              }
              if (
                payment === "dinheiro" &&
                form.change_for &&
                Number(form.change_for.replace(",", ".")) < total
              ) {
                toast.error("O troco precisa cobrir o total.");
                return;
              }
              setReview(true);
            }}
          >
            <section className="rounded-2xl border bg-card p-5 mb-4">
              <h2 className="font-display text-xl mb-4">01. Como podemos chamar você?</h2>
              <div className="space-y-4">
                <CheckoutField
                  label="Seu nome"
                  id="customer_name"
                  value={form.customer_name}
                  onChange={(v) => set("customer_name", v)}
                  required
                  autoComplete="name"
                />
                <CheckoutField
                  label="Telefone com DDD"
                  id="customer_phone"
                  value={form.customer_phone}
                  onChange={(v) => set("customer_phone", v)}
                  required
                  autoComplete="tel"
                  type="tel"
                />
              </div>
            </section>
            <section className="rounded-2xl border bg-card p-5 mb-4">
              <h2 className="font-display text-xl mb-4">02. Como quer receber?</h2>
              <div className="grid grid-cols-2 gap-2 mb-5">
                {(
                  [
                    ["delivery", "Receber em casa", Truck],
                    ["pickup", "Retirar na loja", Store],
                  ] as const
                ).map(([key, label, Icon]) => (
                  <button
                    type="button"
                    key={key}
                    disabled={
                      key === "delivery"
                        ? catalog?.store.delivery_enabled === false
                        : catalog?.store.pickup_enabled === false
                    }
                    aria-pressed={fulfillment === key}
                    className={`flex gap-2 items-center justify-center rounded-xl border py-3 text-xs ${fulfillment === key ? "border-primary bg-primary/5 text-primary" : "text-muted-foreground"}`}
                    onClick={() => {
                      setFulfillment(key);
                      setReview(false);
                    }}
                  >
                    <Icon size={16} />
                    {label}
                  </button>
                ))}
              </div>
              {fulfillment === "delivery" ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {addressFields.map(([key, label]) => (
                    <CheckoutField
                      key={key}
                      id={key}
                      label={label}
                      value={form[key]}
                      onChange={(v) => set(key, v)}
                      required={["street", "number", "neighborhood"].includes(key)}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground leading-6">
                  Retirada simulada. {catalog?.store.address_line}. Confirme o endereço completo da
                  loja antes de operação real.
                </p>
              )}
              {catalog?.store.scheduling_enabled && (
                <div className="mt-5">
                  <Label htmlFor="scheduled">Agendar (opcional, horário de Brasília)</Label>
                  <Input
                    className="mt-2"
                    id="scheduled"
                    type="datetime-local"
                    value={scheduled}
                    onChange={(e) => {
                      setScheduled(e.target.value);
                      setReview(false);
                    }}
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Antecedência de {catalog.store.schedule_lead_minutes} minutos; até{" "}
                    {catalog.store.schedule_days} dias. Em branco: receber assim que possível.
                  </p>
                </div>
              )}
            </section>
            <section className="rounded-2xl border bg-card p-5">
              <h2 className="font-display text-xl mb-4">03. Como pretende pagar?</h2>
              <p className="text-xs text-muted-foreground mb-4">
                Pix direto por QR Code ou cartão na maquininha. Esta demonstração não processa
                cobranças.
              </p>
              <div className="flex gap-2 flex-wrap">
                {(["pix", "credito_entrega", "debito_entrega", "dinheiro"] as const).map((m) => (
                  <button
                    type="button"
                    aria-pressed={m === payment}
                    key={m}
                    onClick={() => {
                      setPayment(m);
                      setReview(false);
                    }}
                    className={`rounded-xl border py-3 px-4 text-xs ${payment === m ? "border-primary text-primary bg-primary/5" : "text-muted-foreground"}`}
                  >
                    {PAYMENT_LABEL[m]}
                  </button>
                ))}
              </div>
              {payment === "pix" && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Ao concluir o pedido, você será levado para a tela com QR Code e Pix Copia e Cola.
                </p>
              )}
              {["credito_entrega", "debito_entrega"].includes(payment) && (
                <p className="mt-3 text-xs text-muted-foreground">
                  A loja levará a maquininha. Pague somente na{" "}
                  {fulfillment === "delivery" ? "entrega" : "retirada"}.
                </p>
              )}
              {payment === "dinheiro" && (
                <div className="mt-4">
                  <CheckoutField
                    id="change_for"
                    label="Troco para (R$), opcional"
                    value={form.change_for}
                    onChange={(v) => set("change_for", v)}
                    type="text"
                  />
                </div>
              )}
              <Label className="block mt-5 mb-2 text-xs" htmlFor="order-notes">
                Alguma observação?
              </Label>
              <Textarea
                id="order-notes"
                value={form.notes}
                maxLength={500}
                onChange={(e) => set("notes", e.target.value)}
                placeholder="O que precisamos saber?"
              />
            </section>
          </form>
          <aside className="rounded-2xl border bg-card p-5 h-fit md:sticky md:top-28">
            <h2 className="font-display text-xl mb-5">Resumo do pedido</h2>
            <div className="space-y-4">
              {lines.map((i) => (
                <div key={i.key} className="text-xs">
                  <div className="flex justify-between gap-3">
                    <strong className="font-medium">
                      {i.quantity}× {i.name}
                      <small className="block text-muted-foreground">
                        {i.saleLabel || "Unidade"}
                      </small>
                    </strong>
                    <span className="shrink-0">{formatBRL(i.total)}</span>
                  </div>
                  {i.addons.map((a) => (
                    <small key={a.id} className="block text-muted-foreground mt-1">
                      + {a.quantity}× {a.name}
                    </small>
                  ))}
                  {i.notes && <small className="block mt-1 text-muted-foreground">{i.notes}</small>}
                </div>
              ))}
            </div>
            <div className="mt-6 border-t pt-4">
              <Label htmlFor="coupon" className="text-xs">
                Tem um cupom?
              </Label>
              <div className="flex gap-2 mt-2">
                <Input
                  id="coupon"
                  value={coupon}
                  onChange={(e) => setCoupon(e.target.value.toUpperCase())}
                  placeholder="LABOR10"
                />
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => {
                    const c = catalog?.coupons.find((c) => c.code === coupon.trim() && c.is_active);
                    if (
                      !c ||
                      subtotal < c.min_total ||
                      (c.expires_at && Date.parse(c.expires_at) < Date.now())
                    ) {
                      toast.error("Cupom inválido, expirado ou abaixo do valor mínimo.");
                      setApplied("");
                      return;
                    }
                    setApplied(c.code);
                    setReview(false);
                    toast.success("Cupom aplicado. Elegibilidade será conferida ao confirmar.");
                  }}
                >
                  Aplicar
                </Button>
              </div>
              <small className="block text-muted-foreground mt-2 text-[10px]">
                LABOR10: cupom fictício de 10%, a partir de R$ 10.
              </small>
            </div>
            <dl className="text-xs space-y-3 mt-5">
              <div className="space-y-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy || !form.customer_phone}
                  onClick={async () => {
                    try {
                      setRecovery(
                        await laborTrackCart({
                          data: {
                            phone: form.customer_phone,
                            products: items.map((i) => ({ id: i.productId, quantity: i.quantity })),
                            consent: true,
                          },
                        }),
                      );
                    } catch (e) {
                      toast.error(
                        e instanceof Error ? e.message : "Não foi possível salvar o carrinho.",
                      );
                    }
                  }}
                >
                  Autorizar lembrete deste carrinho pelo WhatsApp
                </Button>
                {recovery && (
                  <p>
                    {recovery.verified ? (
                      "Número confirmado. Você pode cancelar enviando SAIR."
                    ) : (
                      <>
                        Para confirmar seu número e autorização, envie{" "}
                        <strong>VINCULAR {recovery.code}</strong> ao WhatsApp da loja. A recuperação
                        só será ativada após essa confirmação.
                      </>
                    )}
                  </p>
                )}
              </div>
              <div className="flex justify-between">
                <dt>Subtotal</dt>
                <dd>{formatBRL(subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>{fulfillment === "pickup" ? "Retirada" : "Entrega de teste"}</dt>
                <dd>{formatBRL(fee)}</dd>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-primary">
                  <dt>Desconto {applied}</dt>
                  <dd>− {formatBRL(discount)}</dd>
                </div>
              )}
              <div className="flex justify-between border-t pt-4 font-display text-2xl">
                <dt>Total</dt>
                <dd className="text-primary">{formatBRL(total)}</dd>
              </div>
            </dl>
            {review && (
              <div
                className="mt-5 rounded-xl bg-primary/5 border border-primary/20 p-4 text-xs leading-6"
                aria-live="polite"
              >
                <strong className="text-primary flex gap-2 items-center">
                  <Check size={15} /> Confira antes de confirmar
                </strong>
                <p>
                  {form.customer_name} · {form.customer_phone}
                </p>
                <p>
                  {fulfillment === "pickup"
                    ? "Retirada na loja"
                    : `${form.street}, ${form.number} · ${form.neighborhood}`}
                </p>
                <p>
                  {PAYMENT_LABEL[payment]} · Total {formatBRL(total)}
                </p>
                {scheduled && (
                  <p>
                    Agendado:{" "}
                    {new Date(`${scheduled}:00-03:00`).toLocaleString("pt-BR", {
                      timeZone: "America/Sao_Paulo",
                    })}
                  </p>
                )}
                <button className="underline text-primary" onClick={() => setReview(false)}>
                  Corrigir dados
                </button>
              </div>
            )}
            <Button
              className="w-full h-12 mt-5"
              disabled={
                busy ||
                !catalog ||
                !catalog.ordering_enabled ||
                !catalog.store.is_open ||
                belowMinimum
              }
              {...(review
                ? { type: "button" as const, onClick: confirm }
                : { type: "submit" as const, form: "labor-checkout" })}
            >
              {busy ? "Registrando…" : review ? "Concluir pedido" : "Revisar meu pedido"}
            </Button>
            {belowMinimum && (
              <p role="alert" className="text-sm text-destructive mt-3">
                Mínimo de {formatBRL(catalog?.store.minimum_order || 0)} em produtos após descontos,
                sem entrega. Faltam{" "}
                {formatBRL((catalog?.store.minimum_order || 0) - subtotal + discount)}.
              </p>
            )}
            <p className="text-[10px] text-muted-foreground text-center mt-3">
              Sem cobrança. Seus dados ficam neste servidor local.
            </p>
          </aside>
        </div>
      </div>
    </SiteShell>
  );
}
function CheckoutField({
  label,
  id,
  value,
  onChange,
  required = false,
  type = "text",
  autoComplete,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (s: string) => void;
  required?: boolean;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <div>
      <Label className="text-xs" htmlFor={id}>
        {label}
        {required ? " *" : ""}
      </Label>
      <Input
        className="mt-2"
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        type={type}
        autoComplete={autoComplete}
        maxLength={120}
      />
    </div>
  );
}
