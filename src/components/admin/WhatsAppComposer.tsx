import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { laborCatalog } from "@/lib/labor.functions";
import { waConfig, waTemplateReply, waPropose, waSendMedia } from "@/lib/whatsapp.functions";
import type { LaborOrderInput } from "@/lib/labor.schema";
export function WhatsAppComposer({
  id,
  name,
  phone,
  refresh,
}: {
  id: string;
  name: string;
  phone: string;
  refresh: () => Promise<unknown>;
}) {
  const { data: catalog } = useQuery({
    queryKey: ["labor-order-catalog"],
    queryFn: () => laborCatalog(),
  });
  const { data: wa } = useQuery({ queryKey: ["labor-whatsapp"], queryFn: () => waConfig() });
  const [template, setTemplate] = useState(""),
    [parameters, setParameters] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [product, setProduct] = useState(""),
    [quantity, setQuantity] = useState(1),
    [addons, setAddons] = useState<Record<string, number>>({}),
    [items, setItems] = useState<LaborOrderInput["items"]>([]),
    [fulfillment, setFulfillment] = useState<"delivery" | "pickup">("pickup"),
    [street, setStreet] = useState(""),
    [number, setNumber] = useState(""),
    [neighborhood, setNeighborhood] = useState(""),
    [payment, setPayment] = useState<LaborOrderInput["payment_method"]>("pix"),
    [notes, setNotes] = useState("");
  const chosen = wa?.templates.find((t) => t.id === template),
    p = catalog?.products.find((p) => p.id === product);
  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha na operação");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="p-3 space-y-3">
      <details>
        <summary>Enviar template aprovado</summary>
        <form
          className="support-settings"
          onSubmit={(e) => {
            e.preventDefault();
            if (!chosen) return;
            const text = chosen.body.replace(
              /\{\{(\d+)\}\}/g,
              (_, n) => parameters[Number(n) - 1] || "",
            );
            void run(() =>
              waTemplateReply({
                data: {
                  id,
                  messageId: crypto.randomUUID(),
                  text: text.slice(0, 1000),
                  template: { name: chosen.name, language: chosen.language, parameters },
                },
              }),
            );
          }}
        >
          <label>
            Template
            <select
              value={template}
              required
              onChange={(e) => {
                setTemplate(e.target.value);
                setParameters(
                  Array(wa?.templates.find((t) => t.id === e.target.value)?.variables || 0).fill(
                    "",
                  ),
                );
              }}
            >
              <option value="">Selecione</option>
              {wa?.templates
                .filter((t) => t.status === "APPROVED" && t.usable)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} · {t.language}
                  </option>
                ))}
            </select>
          </label>
          {parameters.map((value, i) => (
            <label key={i}>
              Parâmetro {i + 1}
              <input
                required
                value={value}
                onChange={(e) =>
                  setParameters(parameters.map((v, n) => (n === i ? e.target.value : v)))
                }
              />
            </label>
          ))}
          <p>
            {chosen?.body.replace(
              /\{\{(\d+)\}\}/g,
              (_, n) => parameters[Number(n) - 1] || `[${n}]`,
            )}
          </p>
          <button disabled={busy || !chosen}>Enviar template</button>
        </form>
      </details>
      <label>
        Enviar imagem, áudio ou PDF (até 8 MB)
        <input
          type="file"
          accept="image/jpeg,image/png,audio/ogg,audio/mpeg,application/pdf"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (file.size > 8 * 1024 * 1024) {
              toast.error("Limite de 8 MB.");
              return;
            }
            void run(async () => {
              const data = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onerror = reject;
                reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
                reader.readAsDataURL(file);
              });
              await waSendMedia({
                data: {
                  id,
                  messageId: crypto.randomUUID(),
                  mime: file.type as "image/jpeg",
                  name: file.name.slice(0, 80),
                  data,
                },
              });
            });
            e.target.value = "";
          }}
        />
      </label>
      <details>
        <summary>Preparar pedido para confirmação do cliente</summary>
        <form
          className="support-settings"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              await waPropose({
                data: {
                  id,
                  order: {
                    customer_name: name,
                    customer_phone: phone,
                    fulfillment,
                    street,
                    number,
                    neighborhood,
                    payment_method: payment,
                    notes,
                    request_id: crypto.randomUUID(),
                    items,
                  },
                },
              });
              setItems([]);
              toast.success(
                "Resumo enviado. O cliente precisa responder com o código de confirmação.",
              );
            });
          }}
        >
          <p>
            O servidor calcula preços, adicionais e entrega. Só a confirmação do cliente cria o
            pedido. Checkout local de teste.
          </p>
          <label>
            Produto
            <select
              value={product}
              onChange={(e) => {
                setProduct(e.target.value);
                setAddons({});
                setQuantity(1);
              }}
            >
              <option value="">Selecione</option>
              {catalog?.products
                .filter((p) => !p.is_sold_out)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Quantidade
            <input
              type="number"
              min={p?.min_quantity || 1}
              step={p?.quantity_step || 1}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
            />
          </label>
          {p?.addon_groups.map((g) => (
            <fieldset key={g.id}>
              <legend>
                {g.title} · mínimo {g.is_required ? Math.max(1, g.min_select) : g.min_select},
                máximo {g.max_select}
              </legend>
              {g.product_addons
                .filter((a) => a.is_active)
                .map((a) => (
                  <label key={a.id}>
                    {a.name} · R$ {a.price.toFixed(2)}
                    <input
                      type="number"
                      min="0"
                      max={g.max_select}
                      value={addons[a.id] || 0}
                      onChange={(e) => setAddons({ ...addons, [a.id]: Number(e.target.value) })}
                    />
                  </label>
                ))}
            </fieldset>
          ))}
          <button
            type="button"
            disabled={!p || busy}
            onClick={() => {
              if (!p) return;
              setItems([
                ...items,
                {
                  product_id: p.id,
                  quantity,
                  addons: Object.entries(addons)
                    .filter(([, q]) => q > 0)
                    .map(([addon_id, quantity]) => ({ addon_id, quantity })),
                },
              ]);
            }}
          >
            Adicionar item à proposta
          </button>
          {items.map((i, n) => (
            <p key={n}>
              {i.quantity} × {catalog?.products.find((p) => p.id === i.product_id)?.name}
              <button
                type="button"
                onClick={() => setItems(items.filter((_, index) => index !== n))}
              >
                Remover
              </button>
            </p>
          ))}
          <label>
            Recebimento
            <select
              value={fulfillment}
              onChange={(e) => setFulfillment(e.target.value as typeof fulfillment)}
            >
              <option value="pickup">Retirada</option>
              <option value="delivery">Entrega</option>
            </select>
          </label>
          {fulfillment === "delivery" && (
            <>
              <label>
                Rua
                <input required value={street} onChange={(e) => setStreet(e.target.value)} />
              </label>
              <label>
                Número
                <input required value={number} onChange={(e) => setNumber(e.target.value)} />
              </label>
              <label>
                Bairro
                <input
                  required
                  value={neighborhood}
                  onChange={(e) => setNeighborhood(e.target.value)}
                />
              </label>
            </>
          )}
          <label>
            Pagamento
            <select value={payment} onChange={(e) => setPayment(e.target.value as typeof payment)}>
              <option value="pix">Pix pendente</option>
              <option value="dinheiro">Dinheiro no recebimento</option>
              <option value="credito_entrega">Crédito no recebimento</option>
              <option value="debito_entrega">Débito no recebimento</option>
            </select>
          </label>
          <label>
            Observações
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
          <button disabled={busy || !items.length}>Calcular e enviar proposta</button>
        </form>
      </details>
    </div>
  );
}
