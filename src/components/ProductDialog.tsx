import { useEffect, useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { useCart, type CartItem } from "@/lib/cart";
import { effectivePrice, formatBRL, primaryImage, type Product } from "@/lib/menu";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { saleFor, UNIT_LABELS, validQuantity, lineCents } from "@/lib/vendrex.rules";

export function ProductDialog({
  product,
  open,
  onOpenChange,
  products = [],
  onProductChange,
  editingItem,
}: {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products?: Product[];
  onProductChange?: (product: Product) => void;
  editingItem?: CartItem | null;
}) {
  const { addItem, removeItem } = useCart();
  useEffect(() => {
    if (open && product)
      void import("@/lib/ads.tracking").then((m) => m.trackAdEvent("ViewContent", product.id));
  }, [open, product?.id]);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [saleId, setSaleId] = useState<string | null>(null);

  useEffect(() => {
    setQuantity(editingItem?.quantity || product?.min_quantity || 1);
    setSaleId(editingItem?.saleOptionId || null);
    setNotes(editingItem?.notes || "");
    setSelected(Object.fromEntries((editingItem?.addons || []).map((a) => [a.id, a.quantity])));
  }, [product?.id, open, editingItem]);

  const selectedOption = product?.sale_options?.find((o) => o.id === saleId && o.is_active);
  const remaining = product?.stock?.[saleId || "base"];
  const sale = product ? saleFor(product, selectedOption?.id) : null;
  const unitPrice = product ? (selectedOption?.price ?? effectivePrice(product)) : 0;

  const addonList = useMemo(() => {
    if (!product) return [];
    return product.addon_groups.flatMap((g) =>
      g.product_addons
        .filter((a) => (selected[a.id] ?? 0) > 0)
        .map((a) => ({ id: a.id, name: a.name, price: a.price, quantity: selected[a.id] ?? 0 })),
    );
  }, [product, selected]);

  const total =
    lineCents(
      Math.round(unitPrice * 100) +
        addonList.reduce((sum, a) => sum + Math.round(a.price * 100) * a.quantity, 0),
      quantity,
    ) / 100;

  if (!product) return null;

  const image = primaryImage(product);

  function groupCount(groupId: string, selection = selected) {
    const group = product!.addon_groups.find((g) => g.id === groupId);
    return (group?.product_addons ?? []).reduce((sum, a) => sum + (selection[a.id] ?? 0), 0);
  }

  function change(addonId: string, groupId: string, delta: number) {
    const group = product!.addon_groups.find((g) => g.id === groupId);
    const max = group?.max_select ?? 99;
    setSelected((prev) => {
      const current = prev[addonId] ?? 0;
      const next = current + delta;
      if (next < 0) return prev;
      if (delta > 0 && max > 0 && groupCount(groupId, prev) >= max) {
        toast.info(`Máximo de ${max} opção(ões) em "${group?.title}".`);
        return prev;
      }
      return { ...prev, [addonId]: next };
    });
  }

  function handleAdd() {
    if (!product?.is_active || product.is_sold_out) {
      toast.error("Produto indisponível.");
      return;
    }
    if (
      !sale ||
      (saleId && !selectedOption) ||
      !validQuantity(quantity, sale.min_quantity, sale.quantity_step)
    ) {
      toast.error("Revise a embalagem, a quantidade mínima e os múltiplos.");
      return;
    }
    if (remaining !== undefined && quantity > remaining) {
      toast.error("Quantidade indisponível nesta embalagem.");
      return;
    }
    for (const group of product!.addon_groups) {
      const min = group.is_required ? Math.max(group.min_select, 1) : group.min_select;
      if (
        groupCount(group.id) < min ||
        (group.max_select > 0 && groupCount(group.id) > group.max_select)
      ) {
        toast.error(`Escolha de ${min} a ${group.max_select} opções em "${group.title}".`);
        return;
      }
    }
    if (editingItem) removeItem(editingItem.key);
    addItem({
      productId: product!.id,
      slug: product!.slug,
      name: product!.name,
      image,
      unitPrice,
      quantity,
      notes: notes.trim(),
      addons: addonList,
      saleOptionId: saleId,
      saleLabel: sale.label,
      minQuantity: sale.min_quantity,
      quantityStep: sale.quantity_step,
    });
    toast.success(`${product!.name} adicionado ao carrinho`);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] gap-0 overflow-y-auto p-0 sm:max-w-lg">
        {image ? (
          <img src={image} alt={product.name} className="h-56 w-full object-cover sm:h-64" />
        ) : null}
        <div className="p-5">
          <DialogTitle className="font-display text-3xl leading-tight">{product.name}</DialogTitle>
          {product.description ? (
            <p className="mt-2 text-sm text-muted-foreground">{product.description}</p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
            {product.weight ? (
              <span className="rounded-full bg-muted px-2 py-1">{product.weight}</span>
            ) : null}
            {product.quantity_label ? (
              <span className="rounded-full bg-muted px-2 py-1">{product.quantity_label}</span>
            ) : null}
            {product.serves ? (
              <span className="rounded-full bg-muted px-2 py-1">
                Serve {product.serves} pessoa(s)
              </span>
            ) : null}
          </div>
          <p className="mt-3 font-display text-3xl text-primary">
            {product.price_from ? "A partir de " : ""}
            {formatBRL(unitPrice)}
          </p>
          {!!product.sale_options?.some((o) => o.is_active) && (
            <fieldset className="sale-choices">
              <legend>Como quer comprar?</legend>
              {[
                {
                  id: null,
                  label: UNIT_LABELS[product.sale_unit || "unidade"] || "Unidade",
                  price: effectivePrice(product),
                  min_quantity: product.min_quantity || 1,
                },
                ...product.sale_options.filter((o) => o.is_active),
              ].map((o) => (
                <button
                  key={o.id || "base"}
                  type="button"
                  aria-pressed={saleId === o.id}
                  disabled={product.stock?.[o.id || "base"] === 0}
                  onClick={() => {
                    setSaleId(o.id);
                    setQuantity(o.min_quantity);
                  }}
                >
                  {o.label}
                  <strong>{formatBRL(o.price)}</strong>
                  {product.stock?.[o.id || "base"] === 0 && <small>Esgotado</small>}
                </button>
              ))}
            </fieldset>
          )}
          <p className="text-xs text-muted-foreground mt-3">
            Venda por {sale?.label.toLowerCase()} · mínimo {sale?.min_quantity} · incrementos de{" "}
            {sale?.quantity_step}
          </p>
          {product.slug.includes("copo") && onProductChange && (
            <fieldset className="mt-5">
              <legend className="text-sm font-semibold">Qual é o seu tamanho?</legend>
              <div className="mt-2 flex gap-2">
                {products
                  .filter((p) => p.slug.includes("copo") && p.is_active)
                  .map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => onProductChange(p)}
                      disabled={p.is_sold_out}
                      aria-pressed={p.id === product.id}
                      className={`rounded-xl border px-4 py-3 text-sm ${p.id === product.id ? "border-primary bg-primary/10 text-primary" : "border-border"}`}
                    >
                      {p.quantity_label} · {formatBRL(effectivePrice(p))}
                    </button>
                  ))}
              </div>
            </fieldset>
          )}

          {product.addon_groups.map((group) => (
            <section key={group.id} className="mt-5">
              <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2">
                <h4 className="font-semibold">{group.title}</h4>
                <span className="text-xs text-muted-foreground">
                  {group.is_required ? "Obrigatório" : "Opcional"}
                  {group.max_select > 0 ? ` • até ${group.max_select}` : ""}
                </span>
              </div>
              <ul className="divide-y divide-border">
                {group.product_addons.map((addon) => (
                  <li key={addon.id} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{addon.name}</p>
                      {addon.description ? (
                        <p className="text-xs text-muted-foreground">{addon.description}</p>
                      ) : null}
                      <p className="text-sm text-primary">
                        {addon.price > 0 ? `+ ${formatBRL(addon.price)}` : "Grátis"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        aria-label={`Remover ${addon.name}`}
                        className="h-8 w-8"
                        onClick={() => change(addon.id, group.id, -1)}
                        disabled={(selected[addon.id] ?? 0) === 0}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="w-5 text-center text-sm font-semibold">
                        {selected[addon.id] ?? 0}
                      </span>
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        aria-label={`Adicionar ${addon.name}`}
                        className="h-8 w-8"
                        onClick={() => change(addon.id, group.id, 1)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          <div className="mt-5">
            <label className="text-sm font-semibold" htmlFor="obs">
              Observações
            </label>
            <Textarea
              id="obs"
              value={notes}
              maxLength={300}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Conte como você prefere o seu pedido..."
              className="mt-1"
            />
          </div>
        </div>

        <div className="sticky bottom-0 flex items-center gap-3 border-t border-border bg-card p-4">
          <div className="flex items-center gap-2 rounded-full border border-border px-2 py-1">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="Diminuir quantidade"
              className="h-8 w-8"
              disabled={quantity <= (sale?.min_quantity || 1)}
              onClick={() =>
                setQuantity((q) =>
                  Math.max(
                    sale?.min_quantity || 1,
                    Math.round((q - (sale?.quantity_step || 1)) * 1000) / 1000,
                  ),
                )
              }
            >
              <Minus className="h-4 w-4" />
            </Button>
            <span className="min-w-5 text-center font-semibold">{quantity}</span>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="Aumentar quantidade"
              className="h-8 w-8"
              disabled={
                quantity + (sale?.quantity_step || 1) > 1000 ||
                (remaining !== undefined && quantity + (sale?.quantity_step || 1) > remaining)
              }
              onClick={() =>
                setQuantity((q) => Math.round((q + (sale?.quantity_step || 1)) * 1000) / 1000)
              }
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <Button
            type="button"
            onClick={handleAdd}
            disabled={product.is_sold_out || (remaining !== undefined && quantity > remaining)}
            className="h-11 flex-1 rounded-full text-base font-bold"
          >
            {product.is_sold_out
              ? "Esgotado"
              : remaining !== undefined && quantity > remaining
                ? "Quantidade indisponível"
                : `${editingItem ? "Salvar alterações" : "Adicionar"} • ${formatBRL(total)}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
