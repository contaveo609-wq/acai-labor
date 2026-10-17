import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fetchCategories, fetchProducts, formatBRL, primaryImage } from "@/lib/menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

export function AdminProducts() {
  const queryClient = useQueryClient();
  const { data: products = [], isLoading } = useQuery({ queryKey: ["products"], queryFn: fetchProducts });
  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });
  const [prices, setPrices] = useState<Record<string, string>>({});

  const update = useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<{ price: number; is_active: boolean; is_sold_out: boolean; is_featured: boolean }>;
    }) => {
      const { error } = await supabase.from("products").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Produto atualizado");
      void queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: () => toast.error("Não foi possível atualizar o produto"),
  });

  if (isLoading) return <p className="text-muted-foreground">Carregando produtos...</p>;

  return (
    <div className="space-y-8">
      {categories.map((category) => {
        const items = products.filter((p) => p.category_id === category.id);
        if (!items.length) return null;
        return (
          <section key={category.id}>
            <h3 className="font-display text-2xl">
              {category.emoji} {category.name}
            </h3>
            <ul className="mt-3 space-y-3">
              {items.map((product) => {
                const image = primaryImage(product);
                return (
                  <li
                    key={product.id}
                    className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-3"
                  >
                    {image ? (
                      <img
                        src={image}
                        alt={product.name}
                        width={56}
                        height={56}
                        className="h-14 w-14 rounded-lg object-cover"
                      />
                    ) : null}
                    <div className="min-w-[180px] flex-1">
                      <p className="font-semibold">{product.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Preço atual: {formatBRL(product.price)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Input
                        aria-label={`Novo preço de ${product.name}`}
                        value={prices[product.id] ?? String(product.price)}
                        onChange={(e) =>
                          setPrices((prev) => ({ ...prev, [product.id]: e.target.value.replace(/[^\d.]/g, "") }))
                        }
                        className="h-9 w-24"
                      />
                      <Button
                        size="sm"
                        onClick={() => {
                          const value = Number(prices[product.id] ?? product.price);
                          if (!Number.isFinite(value) || value <= 0) {
                            toast.error("Preço inválido");
                            return;
                          }
                          update.mutate({ id: product.id, patch: { price: value } });
                        }}
                      >
                        Salvar
                      </Button>
                    </div>

                    <label className="flex items-center gap-2 text-xs">
                      <Switch
                        checked={product.is_active}
                        onCheckedChange={(checked) =>
                          update.mutate({ id: product.id, patch: { is_active: checked } })
                        }
                      />
                      Ativo
                    </label>
                    <label className="flex items-center gap-2 text-xs">
                      <Switch
                        checked={product.is_sold_out}
                        onCheckedChange={(checked) =>
                          update.mutate({ id: product.id, patch: { is_sold_out: checked } })
                        }
                      />
                      Esgotado
                    </label>
                    <label className="flex items-center gap-2 text-xs">
                      <Switch
                        checked={product.is_featured}
                        onCheckedChange={(checked) =>
                          update.mutate({ id: product.id, patch: { is_featured: checked } })
                        }
                      />
                      Mais pedido
                    </label>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
