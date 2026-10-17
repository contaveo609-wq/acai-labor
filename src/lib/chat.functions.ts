import { createServerFn } from "@tanstack/react-start";
import { DEMO_MODE } from "./demo";
import { z } from "zod";

const chatSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(2000),
      }),
    )
    .min(1)
    .max(30),
});

export const askAttendant = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => chatSchema.parse(data))
  .handler(async ({ data }) => {
    if (DEMO_MODE) throw new Error("Atendimento externo indisponível no ambiente local.");
    const apiKey = process.env["LOVABLE_API_KEY"];
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: settings }, { data: bot }, { data: products }] = await Promise.all([
      supabaseAdmin.from("store_settings").select("*").maybeSingle(),
      supabaseAdmin.from("chatbot_settings").select("*").maybeSingle(),
      supabaseAdmin
        .from("products")
        .select(
          "name, slug, description, price, price_from, weight, quantity_label, serves, is_active, is_sold_out, is_featured, categories(name), addon_groups(title, min_select, max_select, product_addons(name, price, is_active))",
        )
        .order("sort_order"),
    ]);

    const whatsapp = bot?.whatsapp ?? settings?.whatsapp ?? "556681055779";
    const fallback =
      bot?.fallback_message ??
      "Não tenho essa informação no momento. Vou encaminhar você para nosso atendimento no WhatsApp.";

    if (bot && bot.is_enabled === false) {
      return { reply: fallback, needsWhatsapp: true, whatsapp };
    }

    if (!apiKey) {
      return { reply: fallback, needsWhatsapp: true, whatsapp };
    }

    const knowledge = {
      loja: {
        nome: settings?.store_name,
        endereco: settings?.address_line,
        horario: settings?.opening_hours,
        aberta: settings?.is_open,
        tempo_entrega: `${settings?.delivery_time_min}–${settings?.delivery_time_max} minutos (estimativa, não é garantia)`,
        taxa_entrega: Number(settings?.delivery_fee ?? 0),
        whatsapp,
      },
      produtos: (products ?? []).map((p) => ({
        nome: p.name,
        categoria: (p.categories as { name: string } | null)?.name ?? null,
        descricao: p.description,
        preco: Number(p.price),
        preco_a_partir_de: p.price_from,
        peso: p.weight,
        quantidade: p.quantity_label,
        serve_pessoas: p.serves,
        disponivel: p.is_active && !p.is_sold_out,
        esgotado: p.is_sold_out,
        mais_pedido: p.is_featured,
        adicionais: (p.addon_groups ?? []).map((g) => ({
          grupo: g.title,
          maximo: g.max_select,
          opcoes: (g.product_addons ?? [])
            .filter((a) => a.is_active)
            .map((a) => ({ nome: a.name, preco: Number(a.price) })),
        })),
      })),
      faqs: bot?.faqs ?? [],
    };

    const system = [
      `Você é ${bot?.bot_name ?? "Atendente Virtual Skina"}, atendente virtual da ${settings?.store_name ?? "Skina do Frango & Assados"}.`,
      "Responda em português do Brasil, de forma curta, simpática e objetiva, como um atendente de restaurante.",
      "REGRA CRÍTICA: use SOMENTE os dados do JSON abaixo. NUNCA invente produto, preço, peso, porção, promoção, disponibilidade, prazo ou qualquer informação comercial.",
      `Se a informação não estiver no JSON, responda exatamente: "${fallback}"`,
      "Sempre apresente preços no formato R$ 00,00. Se o produto estiver esgotado, avise que está indisponível no momento.",
      "Você pode ajudar o cliente a montar o pedido sugerindo produtos e adicionais reais e, ao final, apresentar um resumo para ele confirmar no site.",
      "Nunca prometa o tempo de entrega como garantia — trate como estimativa.",
      `DADOS: ${JSON.stringify(knowledge)}`,
    ].join("\n");

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "X-Lovable-AIG-SDK": "fetch",
        },
        body: JSON.stringify({
          model: "google/gemini-3.8-flash",
          messages: [{ role: "system", content: system }, ...data.messages],
        }),
      });

      if (!res.ok) {
        return { reply: fallback, needsWhatsapp: true, whatsapp };
      }

      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const reply = json.choices?.[0]?.message?.content?.trim();
      if (!reply) return { reply: fallback, needsWhatsapp: true, whatsapp };
      return { reply, needsWhatsapp: reply.includes(fallback.slice(0, 25)), whatsapp };
    } catch {
      return { reply: fallback, needsWhatsapp: true, whatsapp };
    }
  });
