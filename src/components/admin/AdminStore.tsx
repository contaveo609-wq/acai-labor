import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fetchStoreSettings } from "@/lib/menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

type Form = {
  store_name: string;
  tagline: string;
  description: string;
  address_line: string;
  opening_hours: string;
  whatsapp: string;
  phone: string;
  delivery_time_min: string;
  delivery_time_max: string;
  delivery_fee: string;
  is_open: boolean;
};

export function AdminStore() {
  const queryClient = useQueryClient();
  const { data: store } = useQuery({ queryKey: ["store"], queryFn: fetchStoreSettings });
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!store) return;
    setForm({
      store_name: store.store_name ?? "",
      tagline: store.tagline ?? "",
      description: store.description ?? "",
      address_line: store.address_line ?? "",
      opening_hours: store.opening_hours ?? "",
      whatsapp: store.whatsapp ?? "",
      phone: store.phone ?? "",
      delivery_time_min: String(store.delivery_time_min ?? 40),
      delivery_time_max: String(store.delivery_time_max ?? 57),
      delivery_fee: String(store.delivery_fee ?? 0),
      is_open: store.is_open ?? true,
    });
  }, [store]);

  if (!form) return <p className="text-muted-foreground">Carregando configurações...</p>;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    const { error } = await supabase
      .from("store_settings")
      .update({
        store_name: form.store_name.trim(),
        tagline: form.tagline.trim(),
        description: form.description.trim(),
        address_line: form.address_line.trim(),
        opening_hours: form.opening_hours.trim(),
        whatsapp: form.whatsapp.replace(/\D/g, ""),
        phone: form.phone.trim(),
        delivery_time_min: Number(form.delivery_time_min),
        delivery_time_max: Number(form.delivery_time_max),
        delivery_fee: Number(form.delivery_fee),
        is_open: form.is_open,
      })
      .eq("id", true);
    setBusy(false);
    if (error) {
      toast.error("Não foi possível salvar as configurações");
      return;
    }
    toast.success("Página atualizada");
    void queryClient.invalidateQueries({ queryKey: ["store"] });
  }

  const set = (key: keyof Form, value: string | boolean) =>
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));

  return (
    <form onSubmit={save} className="max-w-2xl space-y-4 rounded-2xl border border-border bg-card p-5">
      <h3 className="font-display text-2xl">Editor da página</h3>

      <Row label="Nome da loja" value={form.store_name} onChange={(v) => set("store_name", v)} />
      <Row label="Slogan" value={form.tagline} onChange={(v) => set("tagline", v)} />
      <div>
        <Label htmlFor="descricao-loja">Descrição</Label>
        <Textarea
          id="descricao-loja"
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          className="mt-1"
        />
      </div>
      <Row label="Endereço" value={form.address_line} onChange={(v) => set("address_line", v)} />
      <Row label="Horário de funcionamento" value={form.opening_hours} onChange={(v) => set("opening_hours", v)} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Row label="WhatsApp (somente números)" value={form.whatsapp} onChange={(v) => set("whatsapp", v)} />
        <Row label="Telefone exibido" value={form.phone} onChange={(v) => set("phone", v)} />
        <Row
          label="Tempo mínimo de entrega (min)"
          value={form.delivery_time_min}
          onChange={(v) => set("delivery_time_min", v.replace(/\D/g, ""))}
        />
        <Row
          label="Tempo máximo de entrega (min)"
          value={form.delivery_time_max}
          onChange={(v) => set("delivery_time_max", v.replace(/\D/g, ""))}
        />
        <Row
          label="Taxa de entrega (R$)"
          value={form.delivery_fee}
          onChange={(v) => set("delivery_fee", v.replace(/[^\d.]/g, ""))}
        />
      </div>
      <label className="flex items-center gap-3 text-sm font-medium">
        <Switch checked={form.is_open} onCheckedChange={(checked) => set("is_open", checked)} />
        Loja aberta para pedidos
      </label>

      <Button type="submit" disabled={busy} className="h-11 rounded-full px-8 font-semibold">
        {busy ? "Salvando..." : "Salvar alterações"}
      </Button>
    </form>
  );
}

function Row({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = label.toLowerCase().replace(/[^a-z]+/g, "-");
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} className="mt-1" />
    </div>
  );
}
