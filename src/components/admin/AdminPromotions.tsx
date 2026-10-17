import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fetchProducts, formatBRL } from "@/lib/menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export function AdminPromotions() {
  const queryClient = useQueryClient();
  const { data: products = [] } = useQuery({ queryKey: ["products"], queryFn: fetchProducts });
  const [form, setForm] = useState({ product_id: "", title: "", promo_price: "", ends_at: "" });

  const { data: promotions = [] } = useQuery({
    queryKey: ["admin-promotions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("promotions")
        .select("*, products(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin-promotions"] });
    void queryClient.invalidateQueries({ queryKey: ["products"] });
  };

  const create = useMutation({
    mutationFn: async () => {
      const price = Number(form.promo_price);
      if (!form.product_id) throw new Error("Escolha um produto");
      if (!Number.isFinite(price) || price <= 0) throw new Error("Informe um preço promocional válido");
      const { error } = await supabase.from("promotions").insert({
        product_id: form.product_id,
        title: form.title.trim() || "Promoção",
        promo_price: price,
        ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
        is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Promoção criada");
      setForm({ product_id: "", title: "", promo_price: "", ends_at: "" });
      refresh();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Erro ao criar promoção"),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("promotions").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: refresh,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("promotions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Promoção removida");
      refresh();
    },
  });

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-card p-4">
        <h3 className="font-display text-2xl">Nova promoção</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="promo-produto">Produto</Label>
            <select
              id="promo-produto"
              value={form.product_id}
              onChange={(e) => setForm({ ...form, product_id: e.target.value })}
              className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-2 text-sm"
            >
              <option value="">Selecione...</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {formatBRL(p.price)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="promo-titulo">Título</Label>
            <Input
              id="promo-titulo"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Ex.: Combo da semana"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="promo-preco">Preço promocional (R$)</Label>
            <Input
              id="promo-preco"
              value={form.promo_price}
              onChange={(e) => setForm({ ...form, promo_price: e.target.value.replace(/[^\d.]/g, "") })}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="promo-fim">Válida até</Label>
            <Input
              id="promo-fim"
              type="date"
              value={form.ends_at}
              onChange={(e) => setForm({ ...form, ends_at: e.target.value })}
              className="mt-1"
            />
          </div>
        </div>
        <Button className="mt-3" onClick={() => create.mutate()} disabled={create.isPending}>
          Criar promoção
        </Button>
      </section>

      <section>
        <h3 className="font-display text-2xl">Promoções cadastradas</h3>
        {promotions.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Nenhuma promoção cadastrada.</p>
        ) : null}
        <ul className="mt-3 space-y-2">
          {promotions.map((promo) => (
            <li
              key={promo.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-3"
            >
              <div>
                <p className="font-semibold">
                  {promo.title} — {(promo.products as { name: string } | null)?.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {promo.promo_price ? formatBRL(Number(promo.promo_price)) : `${promo.discount_percent}%`}
                  {promo.ends_at
                    ? ` • até ${new Date(promo.ends_at as string).toLocaleDateString("pt-BR")}`
                    : ""}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-xs">
                  <Switch
                    checked={promo.is_active as boolean}
                    onCheckedChange={(checked) => toggle.mutate({ id: promo.id, is_active: checked })}
                  />
                  Ativa
                </label>
                <Button size="sm" variant="outline" onClick={() => remove.mutate(promo.id)}>
                  Remover
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
