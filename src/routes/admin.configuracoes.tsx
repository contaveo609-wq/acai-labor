import { createFileRoute } from "@tanstack/react-router";
import { AdminStore } from "@/components/admin/AdminStore";

export const Route = createFileRoute("/admin/configuracoes")({
  component: AdminConfigRoute,
});

function AdminConfigRoute() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-3xl font-bold tracking-tight">Configurações</h2>
        <p className="text-muted-foreground">Configurações gerais e página da loja.</p>
      </div>
      <AdminStore />
    </div>
  );
}
