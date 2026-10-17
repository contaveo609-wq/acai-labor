import { createFileRoute } from "@tanstack/react-router";
import { AdminPromotions } from "@/components/admin/AdminPromotions";

export const Route = createFileRoute("/admin/promocoes")({
  component: AdminPromocoesRoute,
});

function AdminPromocoesRoute() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-3xl font-bold tracking-tight">Promoções</h2>
        <p className="text-muted-foreground">Gerencie combos e promoções do cardápio.</p>
      </div>
      <AdminPromotions />
    </div>
  );
}
