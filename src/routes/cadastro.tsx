import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SiteShell } from "@/components/SiteShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/cadastro")({
  head: () => ({
    meta: [
      { title: "Criar conta — Skina do Frango & Assados" },
      { name: "description", content: "Crie sua conta para pedir mais rápido e acompanhar suas entregas." },
      { property: "og:title", content: "Criar conta — Skina do Frango & Assados" },
      { property: "og:description", content: "Cadastro rápido de cliente." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", phone: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (form.password.length < 6) {
      toast.error("A senha precisa ter ao menos 6 caracteres.");
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: {
          emailRedirectTo: window.location.origin,
          data: { full_name: form.name.trim(), phone: form.phone.trim() },
        },
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      if (data.session) {
        toast.success("Conta criada com sucesso!");
        navigate({ to: "/meus-pedidos" });
        return;
      }

      // If Supabase didn't automatically establish session, try immediate sign in
      const signInResult = await supabase.auth.signInWithPassword({
        email: form.email.trim(),
        password: form.password,
      });

      if (signInResult.data?.session) {
        toast.success("Conta criada e conectada!");
        navigate({ to: "/meus-pedidos" });
        return;
      }

      toast.success("Conta cadastrada com sucesso!");
      navigate({ to: "/meus-pedidos" });
    } catch (err: any) {
      toast.error(err?.message || "Erro ao criar conta.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SiteShell>
      <div className="mx-auto max-w-md px-4 py-10">
        <h1 className="font-display text-4xl">Criar conta</h1>
        <form onSubmit={submit} className="mt-5 space-y-4 rounded-2xl border border-border bg-card p-5">
          <div>
            <Label htmlFor="nome">Nome completo</Label>
            <Input
              id="nome"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="telefone">WhatsApp</Label>
            <Input
              id="telefone"
              required
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="(66) 90000-0000"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="email-cadastro">E-mail</Label>
            <Input
              id="email-cadastro"
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="senha-cadastro">Senha</Label>
            <Input
              id="senha-cadastro"
              type="password"
              required
              minLength={6}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="mt-1"
            />
          </div>
          <Button type="submit" disabled={busy} className="h-11 w-full rounded-full font-semibold">
            {busy ? "Criando..." : "Criar conta"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Já tem conta?{" "}
            <Link to="/login" className="font-semibold text-primary">
              Entrar
            </Link>
          </p>
        </form>
      </div>
    </SiteShell>
  );
}
