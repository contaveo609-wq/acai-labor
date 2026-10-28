import { createHash, randomUUID } from "node:crypto";
import type { LaborDatabase, LaborOrder } from "./labor.types";
import type { Product } from "./menu";
import { saleFor, validQuantity, operatingAt } from "./vendrex.rules";
import {
  DEFAULT_SUPPORT,
  decisionSchema,
  supportConfigSchema,
  type SupportCard,
  type SupportConfig,
  type SupportConversation,
  type SupportDecision,
  type SupportMessage,
  type SupportView,
} from "./support.types";
import { createSupportVault } from "./support.secrets";
import { createGeminiProvider, type GeminiInput, type GeminiResult } from "./support.gemini";
import { productUnavailable } from "./inventory";

type Dependencies = {
  directory: string;
  storeId?: string;
  read: () => Promise<LaborDatabase>;
  mutate: <T>(fn: (db: LaborDatabase) => T | Promise<T>) => Promise<T>;
  requireAdmin: (token?: string) => void;
  requireSensitive?: (token?: string) => void;
  audit: (db: LaborDatabase, action: string, id: string, detail: string, actor?: string) => void;
  decide?: (input: GeminiInput) => Promise<GeminiResult>;
};
const STORE = "acai-labor";
const RETENTION = 30 * 86400000;
const digest = (s: string) => createHash("sha256").update(s).digest("hex");
const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const money = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
function state(db: LaborDatabase) {
  const current = (db.support ??= { config: { ...DEFAULT_SUPPORT }, conversations: [], usage: [] });
  current.config = { ...DEFAULT_SUPPORT, ...current.config };
  return current;
}
function published(db: LaborDatabase) {
  return db.products.filter(
    (p) => p.is_active && db.categories.some((c) => c.id === p.category_id && c.is_active),
  ).map((p) => ({ ...p, is_sold_out: productUnavailable(db, p) }));
}
export function supportPrice(p: Product) {
  const now = Date.now();
  const promo = p.promotions.find(
    (r) =>
      r.is_active &&
      (!r.starts_at || Date.parse(r.starts_at) <= now) &&
      (!r.ends_at || Date.parse(r.ends_at) >= now),
  );
  return (
    (promo?.promo_price != null
      ? Math.round(promo.promo_price * 100)
      : promo?.discount_percent != null
        ? Math.round(Math.round(p.price * 100) * (1 - promo.discount_percent / 100))
        : Math.round(p.price * 100)) / 100
  );
}
function card(p: Product, quantity = p.min_quantity || 1): SupportCard {
  const sale = saleFor(p);
  const required = p.addon_groups.some((g) => g.is_required || g.min_select > 0);
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    description: (p.description || "").slice(0, 1000),
    price: supportPrice(p),
    priceFrom: p.price_from,
    available: !p.is_sold_out,
    quantity,
    canAdd:
      !p.is_sold_out && !required && validQuantity(quantity, sale.min_quantity, sale.quantity_step),
  };
}
function view(c: SupportConversation): SupportView {
  return structuredClone({
    id: c.id,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    mode: c.mode,
    messages: c.messages,
  });
}
function findOwned(db: LaborDatabase, owner: string | undefined, id: string, storeId = STORE) {
  const c = state(db).conversations.find(
    (c) =>
      c.id === id &&
      c.storeId === storeId &&
      c.ownerHash === digest(owner || "") &&
      Date.parse(c.updatedAt) > Date.now() - RETENTION,
  );
  if (!owner || !c) throw new Error("Conversa não encontrada nesta sessão.");
  return c;
}
function append(
  c: SupportConversation,
  role: SupportMessage["role"],
  text: string,
  extra: Partial<SupportMessage> = {},
) {
  const at = new Date().toISOString();
  c.messages.push({ id: randomUUID(), role, text, at, ...extra });
  c.updatedAt = at;
}
function intent(text: string, c: SupportConversation, db: LaborDatabase): SupportDecision {
  const t = normalize(text);
  const base: SupportDecision = {
    action: "unknown",
    query: "",
    productIds: [],
    quantity: c.summary.quantity || 1,
    orderId: "",
  };
  if (/\b(atendente|humano|pessoa|reclamacao)\b/.test(t)) return { ...base, action: "human" };
  if (/\b(ignore|senha|token|segredo|sql|admin|pago|alterar preco)\b/.test(t)) return base;
  if (/\b(oi|ola|bom dia|boa tarde|boa noite)\b/.test(t) && t.length < 45)
    return { ...base, action: "greeting" };
  if (/\b(entrega|taxa|horario|pagamento|retirada|endereco|prazo|funciona|aberto)\b/.test(t))
    return { ...base, action: "store" };
  if (/\b(pedido|status)\b/.test(t))
    return { ...base, action: "order", orderId: text.match(/[0-9a-f-]{36}/i)?.[0] || "" };
  if (/\b(oferta|ofertas|promocao|promocoes|desconto)\b/.test(t))
    return { ...base, action: "offers" };
  const words = t
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(
      (w) =>
        w.length > 2 &&
        ![
          "quero",
          "qual",
          "quanto",
          "custa",
          "tem",
          "preco",
          "para",
          "adicionar",
          "carrinho",
          "mais",
          "uma",
          "com",
          "ver",
          "por",
          "favor",
        ].includes(w),
    );
  const matches = published(db)
    .map((p) => ({ p, score: words.filter((w) => normalize(p.name).includes(w)).length }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  const max = matches[0]?.score || 0;
  const ids = matches
    .filter((x) => x.score === max)
    .slice(0, 6)
    .map((x) => x.p.id);
  if (/\b(adicionar|carrinho|unidades|quero mais)\b/.test(t))
    return {
      ...base,
      action: "cart",
      productIds: ids.length ? ids : c.summary.productIds,
      quantity: Number(
        t.match(/\b(\d{1,3})(?:\s+(?:unidades|unidade|copos|caixas))\b/)?.[1] ||
          c.summary.quantity ||
          1,
      ),
    };
  if (ids.length) return { ...base, action: "product", productIds: ids };
  if (/\b(produtos|cardapio|opcoes|combo|combos|recomenda)\b/.test(t))
    return { ...base, action: "products", query: /combo/.test(t) ? "combo" : "" };
  return base;
}
function answer(db: LaborDatabase, c: SupportConversation, decision: SupportDecision) {
  const products = published(db);
  const selected = products.filter((p) => decision.productIds.includes(p.id));
  const add = (text: string, cards?: SupportCard[]) => {
    const config = state(db).config;
    if (config.prohibitedMessages?.some((phrase) => normalize(text).includes(normalize(phrase)))) {
      c.mode = "waiting";
      c.version++;
      text = "Sua dúvida será encaminhada à equipe da loja.";
      cards = undefined;
    } else if (config.tone === "acolhedor") text = `Vamos ajudar! ${text}`;
    else if (config.tone === "formal") text = `Informações da loja: ${text}`;
    if (config.emojis) text = `${text} 💜`;
    append(c, "assistant", text, {
      ...(cards?.length ? { cards } : {}),
      replyTo: c.pending?.id || c.messages.filter((m) => m.role === "customer").at(-1)?.id || "",
    });
  };
  switch (decision.action) {
    case "greeting":
      add(state(db).config.greeting);
      break;
    case "human":
      c.mode = "waiting";
      c.version++;
      add(
        "Solicitação registrada. Uma pessoa da loja poderá responder aqui. Não há prazo de resposta confirmado.",
      );
      break;
    case "store": {
      const s = db.store;
      add(
        `${s.store_name}\n${s.is_open && operatingAt(s) ? "Loja aberta conforme cadastro." : "Loja fechada conforme cadastro."}\nHorários: ${s.opening_hours || "consulte a loja"}.\n${s.delivery_enabled ? `Entrega: taxa cadastrada ${money(s.delivery_fee)}. Área atendida depende de confirmação da loja.` : "Entrega desativada."}\n${s.pickup_enabled ? `Retirada: ${s.address_line || "endereço a confirmar"}.` : "Retirada desativada."}\nPedido mínimo: ${money(s.minimum_order || 0)}.\nCheckout local de demonstração: Pix, dinheiro, crédito ou débito no recebimento; nenhuma cobrança online é gerada. Prazo de entrega precisa ser confirmado pela loja.`,
      );
      break;
    }
    case "order": {
      const orders = (db.orders as (LaborOrder & { owner?: string })[]).filter(
        (o) => o.owner === c.ownerHash,
      );
      const order = decision.orderId
        ? orders.find((o) => o.id === decision.orderId)
        : orders.at(-1);
      add(
        order
          ? `Pedido #${order.order_number}: ${order.status}. Total ${money(order.total)}. Pagamento: ${order.payment_status || "pendente"}. Pedido de demonstração, sem cobrança online.`
          : "Nenhum pedido autorizado encontrado nesta sessão. Abra o acompanhamento no navegador usado na compra ou solicite atendente.",
      );
      break;
    }
    case "products":
    case "product":
    case "offers":
    case "cart": {
      let found = selected;
      if (decision.action === "offers")
        found = products.filter((p) => !p.is_sold_out && supportPrice(p) < p.price);
      if (decision.action === "products")
        found = products.filter(
          (p) =>
            !p.is_sold_out &&
            (!decision.query || normalize(p.name).includes(normalize(decision.query))),
        );
      if (!found.length && decision.action === "product" && decision.query)
        found = products.filter((p) => normalize(p.name).includes(normalize(decision.query)));
      const cards = found
        .slice(0, 6)
        .map((p) => card(p, decision.action === "cart" ? decision.quantity : p.min_quantity || 1));
      add(
        cards.length
          ? decision.action === "cart"
            ? "Confira produto e quantidade. Toque em Adicionar para confirmar; opções obrigatórias devem ser escolhidas no cardápio."
            : "Encontrei estas opções no cardápio. Os preços abaixo vêm do cadastro da loja."
          : "Não encontrei opções correspondentes no catálogo publicado. Tente o nome do produto ou solicite atendente.",
        cards,
      );
      c.summary.productIds = cards.map((p) => p.id);
      c.summary.quantity = decision.quantity;
      break;
    }
    default:
      if (state(db).config.handoffUnknown) {
        c.mode = "waiting";
        c.version++;
      }
      add(
        "Posso consultar produtos, ofertas, horários e seu pedido. Para outras dúvidas, use Solicitar atendente.",
      );
  }
  c.summary.action = decision.action;
}

export function createSupportService(deps: Dependencies) {
  const STORE = deps.storeId || "acai-labor";
  const owned = (db: LaborDatabase, owner: string | undefined, id: string) =>
    findOwned(db, owner, id, STORE);
  const vault = createSupportVault(deps.directory);
  const provider = createGeminiProvider(() => vault.get());
  const decide = deps.decide || ((input: GeminiInput) => provider.decide(input));
  const active = new Set<string>();
  const usage = (db: LaborDatabase) => {
    const s = state(db),
      day = new Date().toISOString().slice(0, 10);
    let u = s.usage.find((u) => u.day === day);
    if (!u) s.usage.push((u = { day, requests: 0, tokens: 0, errors: 0, discarded: 0 }));
    s.usage = s.usage.filter(
      (u) => u.day >= new Date(Date.now() - RETENTION).toISOString().slice(0, 10),
    );
    return u;
  };
  return {
    async open(owner?: string, contact?: { phone: string; name: string; at: string }) {
      if (!owner) throw new Error("Identificação do visitante necessária.");
      return deps.mutate((db) => {
        const s = state(db);
        s.conversations = s.conversations.filter(
          (c) => Date.parse(c.updatedAt) > Date.now() - RETENTION,
        );
        if (!s.config.enabled && !contact)
          return { enabled: false, name: s.config.name, conversation: null };
        let c = s.conversations.find(
          (c) => c.ownerHash === digest(owner) && c.storeId === STORE && c.mode !== "closed",
        );
        if (!c) {
          if (s.conversations.length >= 1000)
            throw new Error("Atendimento temporariamente indisponível.");
          const at = new Date().toISOString();
          c = {
            id: randomUUID(),
            ownerHash: digest(owner),
            storeId: STORE,
            channel: contact ? "whatsapp" : "site",
            ...(contact
              ? { contact: { phone: contact.phone, name: contact.name }, lastInboundAt: contact.at }
              : {}),
            createdAt: at,
            updatedAt: at,
            mode: "automatic",
            version: 0,
            messages: [],
            requests: 0,
            summary: { productIds: [], quantity: 1, action: "greeting" },
          };
          append(c, "assistant", s.config.greeting);
          s.conversations.push(c);
          deps.audit(
            db,
            "atendimento.aberto",
            c.id,
            contact ? "Conversa do WhatsApp" : "Conversa do site",
            "cliente",
          );
        }
        return { enabled: true, name: s.config.name, conversation: view(c) };
      });
    },
    async get(owner: string | undefined, id: string) {
      return view(owned(await deps.read(), owner, id));
    },
    async send(
      owner: string | undefined,
      id: string,
      messageId: string,
      text: string,
      incoming?: {
        at: string;
        humanOnly: boolean;
        media?: { mime: string; data: string } | undefined;
      },
    ) {
      const content = text.trim();
      if (!content || content.length > 1000)
        throw new Error("Envie uma mensagem entre 1 e 1.000 caracteres.");
      const plan = await deps.mutate((db) => {
        const c = owned(db, owner, id),
          s = state(db);
        if (!s.config.enabled && c.channel !== "whatsapp")
          throw new Error("Atendimento desativado.");
        const previous = c.messages.find((m) => m.id === messageId);
        if (previous) {
          if (previous.text !== content || previous.role !== "customer")
            throw new Error("Identificador já utilizado em outra mensagem.");
          return { conversation: view(c) };
        }
        if (c.pending && (active.has(c.id) || Date.parse(c.pending.at) > Date.now() - 60000))
          throw new Error("Aguarde a resposta da mensagem anterior.");
        if (c.pending) {
          c.pending = undefined;
          c.mode = "waiting";
          append(
            c,
            "system",
            "Atendimento automático interrompido. Solicitação encaminhada à loja.",
          );
        }
        if (c.mode === "closed")
          throw new Error("Conversa encerrada. Reabra a ajuda para iniciar outra.");
        if (c.messages.length >= 200)
          throw new Error("Limite do histórico atingido. Solicite o encerramento à loja.");
        const recent = c.messages.filter(
          (m) => m.role === "customer" && Date.parse(m.at) > Date.now() - 60000,
        );
        if (recent.length >= 10) throw new Error("Muitas mensagens. Aguarde um minuto.");
        const stale = incoming && c.lastInboundAt && incoming.at < c.lastInboundAt;
        append(c, "customer", content, { id: messageId, ...(incoming ? { at: incoming.at } : {}) });
        if (incoming && (!c.lastInboundAt || incoming.at > c.lastInboundAt))
          c.lastInboundAt = incoming.at;
        if (c.mode !== "automatic" || incoming?.humanOnly || stale)
          return { conversation: view(c) };
        if (s.config.businessHoursOnly && (!db.store.is_open || !operatingAt(db.store))) {
          c.mode = "waiting";
          c.version++;
          append(
            c,
            "assistant",
            "Sua mensagem está registrada. A equipe continuará o atendimento no horário da loja.",
            { replyTo: messageId },
          );
          return { conversation: view(c) };
        }
        const local = intent(content, c, db);
        if (local.action === "human") {
          answer(db, c, local);
          deps.audit(db, "atendimento.solicitado", id, "Cliente solicitou atendente", "cliente");
          return { conversation: view(c) };
        }
        if (!(c.channel === "whatsapp" ? s.config.whatsappGeminiEnabled : s.config.geminiEnabled)) {
          answer(db, c, local);
          return { conversation: view(c) };
        }
        const u = usage(db);
        const isSite = c.channel !== "whatsapp";
        const minute = new Date().toISOString().slice(0, 16);
        s.minuteUsage = (s.minuteUsage || []).filter((entry) => entry.minute === minute);
        let minuteCounter = s.minuteUsage[0];
        if (!minuteCounter)
          s.minuteUsage.push((minuteCounter = { minute, siteRequests: 0 }));
        if (
          u.requests >= s.config.dailyLimit ||
          c.requests >= (isSite ? s.config.siteConversationLimit : s.config.conversationLimit) ||
          (isSite &&
            ((u.siteRequests || 0) >= s.config.siteDailyLimit ||
              minuteCounter.siteRequests >= s.config.siteMinuteLimit))
        ) {
          c.mode = "waiting";
          append(
            c,
            "system",
            "Limite do atendimento automático atingido. A loja poderá continuar esta conversa.",
          );
          deps.audit(db, "ia.limite", id, "Limite administrativo atingido");
          return { conversation: view(c) };
        }
        u.requests++;
        if (isSite) {
          u.siteRequests = (u.siteRequests || 0) + 1;
          minuteCounter.siteRequests++;
        }
        c.requests++;
        c.pending = { id: messageId, at: new Date().toISOString(), version: c.version };
        active.add(c.id);
        // Controlled summary contains only validated catalog IDs, quantity and an intent enum.
        const context = JSON.stringify({
          preferences: {
            tone: s.config.tone || "direto",
            businessInstructions: s.config.businessInstructions || "",
          },
          summary: c.summary,
          messages: c.messages
            .filter((m) => m.role !== "system")
            .slice(-5)
            .map((m) => ({ role: m.role, text: m.text.slice(0, 1000) })),
          products: published(db)
            .slice(0, 500)
            .map((p) => ({ id: p.id, name: p.name, available: !p.is_sold_out })),
        });
        return {
          input: { model: s.config.model, context, media: incoming?.media },
          version: c.version,
        };
      });
      if ("conversation" in plan) return plan.conversation!;
      let result: GeminiResult | undefined;
      try {
        const candidate = await decide(plan.input);
        result = {
          decision: decisionSchema.parse(candidate.decision),
          tokens:
            Number.isSafeInteger(candidate.tokens) && candidate.tokens > 0 ? candidate.tokens : 0,
        };
      } catch {
        /* Failure is recorded without storing the raw provider error or secrets. */
      }
      try {
        return await deps.mutate((db) => {
          const c = owned(db, owner, id),
            u = usage(db);
          if (result) u.tokens += Math.max(0, result.tokens || 0);
          else u.errors++;
          if (
            c.mode !== "automatic" ||
            c.version !== plan.version ||
            c.pending?.id !== messageId ||
            !(c.channel === "whatsapp"
              ? state(db).config.whatsappGeminiEnabled
              : state(db).config.geminiEnabled) ||
            (c.channel !== "whatsapp" && !state(db).config.enabled)
          ) {
            u.discarded++;
            if (c.pending?.id === messageId) c.pending = undefined;
            return view(c);
          }
          if (result) answer(db, c, result.decision);
          else {
            c.mode = "waiting";
            c.version++;
            append(
              c,
              "system",
              "Assistente indisponível agora. Sua mensagem está registrada para atendimento humano.",
            );
            deps.audit(
              db,
              "ia.falha",
              id,
              "Resposta indisponível; encaminhado ao atendimento humano",
            );
          }
          c.pending = undefined;
          return view(c);
        });
      } finally {
        active.delete(id);
      }
    },
    async handoff(owner: string | undefined, id: string) {
      return deps.mutate((db) => {
        const c = owned(db, owner, id);
        if (c.mode === "automatic") {
          c.mode = "waiting";
          c.version++;
          c.pending = undefined;
          append(
            c,
            "system",
            "Atendente solicitado. A loja responderá nesta conversa quando estiver disponível.",
          );
          deps.audit(db, "atendimento.solicitado", id, "Cliente solicitou atendente", "cliente");
        }
        return view(c);
      });
    },
    async cart(owner: string | undefined, id: string, messageId: string, productId: string) {
      const db = await deps.read(),
        c = owned(db, owner, id);
      const suggestion = c.messages
        .find((m) => m.id === messageId && m.role === "assistant")
        ?.cards?.find((p) => p.id === productId);
      const p = published(db).find((p) => p.id === productId);
      if (!suggestion || !p)
        throw new Error("Sugestão não encontrada. Consulte o produto novamente.");
      const current = card(p, suggestion.quantity);
      if (!current.canAdd)
        throw new Error("Revise disponibilidade, quantidade e adicionais no cardápio.");
      if (current.price !== suggestion.price)
        throw new Error("Preço atualizado. Consulte o produto novamente antes de adicionar.");
      return {
        productId: p.id,
        slug: p.slug,
        name: p.name,
        image: p.product_images.find((i) => i.is_primary)?.url || null,
        unitPrice: current.price,
        quantity: current.quantity,
        notes: "",
        addons: [],
        minQuantity: p.min_quantity || 1,
        quantityStep: p.quantity_step || 1,
      };
    },
    async inbox(token?: string) {
      deps.requireAdmin(token);
      const db = await deps.read(),
        s = state(db);
      return s.conversations
        .filter((c) => c.storeId === STORE && Date.parse(c.updatedAt) > Date.now() - RETENTION)
        .map((c) => ({
          ...view(c),
          channel: c.channel || "site",
          contact: c.contact,
          lastInboundAt: c.lastInboundAt,
        }))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },
    async control(token: string | undefined, id: string, action: "claim" | "resume" | "close") {
      deps.requireAdmin(token);
      return deps.mutate((db) => {
        const c = state(db).conversations.find((c) => c.id === id && c.storeId === STORE);
        if (!c) throw new Error("Conversa não encontrada.");
        if (c.mode === "closed") throw new Error("Conversa encerrada.");
        c.version++;
        c.pending = undefined;
        c.mode = action === "claim" ? "human" : action === "resume" ? "automatic" : "closed";
        append(
          c,
          "system",
          action === "claim"
            ? "Uma pessoa da loja assumiu o atendimento."
            : action === "resume"
              ? "Atendimento automático reativado."
              : "Atendimento encerrado. Obrigado pela conversa!",
        );
        deps.audit(db, `atendimento.${action}`, id, "Alteração do responsável pelo atendimento");
        return view(c);
      });
    },
    async reply(token: string | undefined, id: string, messageId: string, text: string) {
      deps.requireAdmin(token);
      if (!text.trim() || text.trim().length > 1000)
        throw new Error("Mensagem deve ter entre 1 e 1.000 caracteres.");
      return deps.mutate((db) => {
        const c = state(db).conversations.find((c) => c.id === id && c.storeId === STORE);
        if (!c) throw new Error("Conversa não encontrada.");
        const previous = c.messages.find((m) => m.id === messageId);
        if (previous) {
          if (previous.role !== "human" || previous.text !== text.trim())
            throw new Error("Identificador já utilizado.");
          return view(c);
        }
        if (c.mode !== "human") throw new Error("Assuma o atendimento antes de responder.");
        if (c.messages.length >= 200)
          throw new Error("Limite do histórico atingido. Encerre este atendimento.");
        append(c, "human", text.trim(), { id: messageId });
        deps.audit(db, "atendimento.resposta", id, "Mensagem enviada pelo proprietário local");
        return view(c);
      });
    },
    async config(token?: string) {
      deps.requireAdmin(token);
      const s = state(await deps.read());
      return {
        config: s.config,
        usage: s.usage,
        lastTest: s.lastTest || null,
        hasKey: await vault.configured(),
      };
    },
    async saveConfig(token: string | undefined, input: SupportConfig) {
      deps.requireAdmin(token);
      const config = supportConfigSchema.parse(input);
      return deps.mutate((db) => {
        const s = state(db);
        if (
          (config.geminiEnabled || config.whatsappGeminiEnabled) &&
          (!s.lastTest?.ok || s.lastTest.model !== config.model)
        )
          throw new Error("Teste o modelo selecionado antes de ativar o Gemini.");
        s.config = config;
        for (const c of s.conversations) {
          c.version++;
          if (c.pending) {
            c.pending = undefined;
            c.mode = "waiting";
            append(c, "system", "Configuração atualizada. Atendimento encaminhado à loja.");
          }
        }
        deps.audit(db, "ia.configuracao", STORE, "Preferências de atendimento atualizadas");
        return { ok: true };
      });
    },
    async replaceKey(token: string | undefined, key: string) {
      (deps.requireSensitive || deps.requireAdmin)(token);
      if (key.length < 20 || key.length > 250 || /\s/.test(key))
        throw new Error("Formato de chave inválido.");
      return deps.mutate(async (db) => {
        await vault.replace(key);
        const s = state(db);
        s.lastTest = undefined;
        s.config.geminiEnabled = false;
        s.config.whatsappGeminiEnabled = false;
        s.keyRevision = (s.keyRevision || 0) + 1;
        for (const c of s.conversations) c.version++;
        deps.audit(db, "ia.chave", STORE, "Chave substituída no cofre; conteúdo não registrado");
        return { ok: true };
      });
    },
    async models(token?: string) {
      deps.requireAdmin(token);
      return provider.models();
    },
    async test(token: string | undefined, model: string) {
      deps.requireAdmin(token);
      const testId = randomUUID();
      const at = new Date().toISOString();
      // Reserve a request under the same lock as customer requests.
      const revision = await deps.mutate((db) => {
        const u = usage(db);
        if (u.requests >= state(db).config.dailyLimit)
          throw new Error("Limite diário administrativo atingido.");
        u.requests++;
        return state(db).keyRevision || 0;
      });
      let ok = false,
        tokens = 0,
        error = "";
      try {
        const result = await provider.decide({
          model,
          context: JSON.stringify({
            messages: [{ role: "customer", text: "Olá" }],
            products: [],
            summary: {},
          }),
        });
        tokens = result.tokens;
        ok = true;
      } catch {
        error = "Teste falhou. Confira chave, modelo, conexão e cota no Google AI Studio.";
      }
      return deps.mutate((db) => {
        const s = state(db),
          u = usage(db);
        u.tokens += tokens;
        if (!ok) u.errors++;
        if ((s.keyRevision || 0) !== revision)
          throw new Error("A chave mudou durante o teste. Teste novamente.");
        s.lastTest = { at, ok, model, error };
        deps.audit(
          db,
          "ia.teste",
          testId,
          ok ? "Modelo respondeu ao teste" : "Teste de modelo falhou",
        );
        return s.lastTest;
      });
    },
  };
}
