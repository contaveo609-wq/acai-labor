import { DEMO_MODE } from "@/lib/demo";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Minus, Plus, Trash2 } from "lucide-react";
import { SiteShell } from "@/components/SiteShell";
import { Button } from "@/components/ui/button";
import { itemTotal, useCart, type CartItem } from "@/lib/cart";
import { fetchStoreSettings, fetchProducts, formatBRL } from "@/lib/menu";
import { useState } from "react";
import { ProductDialog } from "@/components/ProductDialog";

export const Route = createFileRoute("/carrinho")({
  head: () =>
    DEMO_MODE
      ? {
          meta: [
            { title: "Carrinho — Açaí Labor" },
            {
              name: "description",
              content: "Revise o seu pedido da Açaí Labor.",
            },
            { name: "robots", content: "noindex, nofollow" },
          ],
        }
      : {
          meta: [
            { title: DEMO_MODE ? "Carrinho — Açaí Labor" : "Carrinho — Skina do Frango & Assados" },
            { name: "description", content: "Revise os itens do seu pedido antes de finalizar." },
            { property: "og:title", content: "Carrinho — Skina do Frango & Assados" },
            {
              property: "og:description",
              content: "Revise os itens do seu pedido antes de finalizar.",
            },
            { property: "og:type", content: "website" },
            { name: "twitter:card", content: "summary" },
          ],
        },
  component: CarrinhoPage,
});

function CarrinhoPage() {
  const { items, subtotal, updateQuantity, removeItem } = useCart();
  const { data: store } = useQuery({ queryKey: ["store"], queryFn: fetchStoreSettings });
  const fee = Number(store?.delivery_fee ?? 0);
  const { data: products = [] } = useQuery({ queryKey: ["products"], queryFn: fetchProducts });
  const [editing, setEditing] = useState<CartItem | null>(null);

  return (
    <SiteShell>
      <div className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="font-display text-4xl">Seu carrinho</h1>

        {items.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-border bg-card p-8 text-center">
            <p className="text-muted-foreground">Seu carrinho está vazio.</p>
            <Link to="/cardapio" className="mt-4 inline-block font-semibold text-primary">
              Ver cardápio
            </Link>
          </div>
        ) : (
          <>
            <ul className="mt-4 space-y-3">
              {items.map((item) => (
                <li
                  key={item.key}
                  className="flex gap-3 rounded-2xl border border-border bg-card p-3"
                >
                  {item.image ? (
                    <img
                      src={item.image}
                      alt={item.name}
                      width={72}
                      height={72}
                      className="h-18 w-18 h-[72px] w-[72px] shrink-0 rounded-xl object-cover"
                    />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{item.saleLabel || "Unidade"}</p>
                    <button
                      type="button"
                      className="text-xs text-primary underline mt-1"
                      onClick={() => setEditing(item)}
                    >
                      Editar opções e observações
                    </button>
                    {item.addons.length ? (
                      <ul className="mt-0.5 text-xs text-muted-foreground">
                        {item.addons.map((a) => (
                          <li key={a.id}>
                            + {a.quantity}x {a.name} ({formatBRL(a.price)})
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {item.notes ? (
                      <p className="mt-0.5 text-xs italic text-muted-foreground">
                        Obs.: {item.notes}
                      </p>
                    ) : null}
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center gap-2 rounded-full border border-border px-1.5">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          aria-label="Diminuir"
                          disabled={item.quantity <= (item.minQuantity || 1)}
                          onClick={() =>
                            updateQuantity(item.key, item.quantity - (item.quantityStep || 1))
                          }
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </Button>
                        <span className="w-4 text-center text-sm font-semibold">
                          {item.quantity}
                        </span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          aria-label="Aumentar"
                          onClick={() =>
                            updateQuantity(item.key, item.quantity + (item.quantityStep || 1))
                          }
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-display text-xl text-primary">
                          {formatBRL(itemTotal(item))}
                        </span>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Remover ${item.name}`}
                          onClick={() => removeItem(item.key)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-6 rounded-2xl border border-border bg-card p-4">
              <div className="flex justify-between text-sm">
                <span>Subtotal</span>
                <span>{formatBRL(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Taxa de entrega</span>
                <span>{fee > 0 ? formatBRL(fee) : "A combinar"}</span>
              </div>
              <div className="mt-2 flex justify-between border-t border-border pt-2 font-display text-2xl">
                <span>Total</span>
                <span className="text-primary">{formatBRL(subtotal + fee)}</span>
              </div>
              <Link
                to="/checkout"
                className="mt-4 flex h-12 items-center justify-center rounded-full bg-primary font-display text-2xl tracking-wide text-primary-foreground"
              >
                Finalizar pedido
              </Link>
            </div>
          </>
        )}
      </div>
      <ProductDialog
        product={products.find((p) => p.id === editing?.productId) || null}
        editingItem={editing}
        open={!!editing}
        onOpenChange={(v) => {
          if (!v) setEditing(null);
        }}
      />
    </SiteShell>
  );
}
