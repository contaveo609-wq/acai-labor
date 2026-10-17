import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { SiteShell } from "@/components/SiteShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/minha-conta")({
  head: () => ({
    meta: [
      { title: "Minha conta — Skina do Frango & Assados" },
      { name: "description", content: "Atualize seus dados de contato e entrega." },
      { property: "og:title", content: "Minha conta — Skina do Frango & Assados" },
      { property: "og:description", content: "Atualize seus dados de contato." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Account,
});

function Account() {
  const { user } = useSession();
  const navigate = useNavigate();
  const [form, setForm] = useState({ full_name: "", phone: "" });
  const [busy, setBusy] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, phone")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (profile) setForm({ full_name: profile.full_name ?? "", phone: profile.phone ?? "" });
  }, [profile]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: form.full_name.trim(), phone: form.phone.trim() })
      .eq("id", user.id);
    setBusy(false);
    if (error) toast.error("Não foi possível salvar.");
    else toast.success("Dados atualizados!");
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  return (
    <SiteShell>
      <div className="mx-auto max-w-md px-4 py-8">
        <h1 className="font-display text-4xl">Minha conta</h1>
        <form onSubmit={save} className="mt-5 space-y-4 rounded-2xl border border-border bg-card p-5">
          <div>
            <Label htmlFor="conta-nome">Nome</Label>
            <Input
              id="conta-nome"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="conta-phone">WhatsApp</Label>
            <Input
              id="conta-phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="mt-1"
            />
          </div>
          <p className="text-sm text-muted-foreground">E-mail: {user?.email}</p>
          <Button type="submit" disabled={busy} className="h-11 w-full rounded-full font-semibold">
            {busy ? "Salvando..." : "Salvar alterações"}
          </Button>
          <Button type="button" variant="outline" onClick={signOut} className="h-11 w-full rounded-full">
            Sair da conta
          </Button>
        </form>
      </div>
    </SiteShell>
  );
}
