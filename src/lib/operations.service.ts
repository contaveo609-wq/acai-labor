import { createHash, randomUUID, randomBytes } from "node:crypto";
import { z } from "zod";
import type { LaborDatabase } from "./labor.types";
import type { LaborDependencies } from "./labor.dependencies";
import { DEFAULT_OPERATIONS, operationsConfigSchema, campaignSchema } from "./operations.types";
import type { LedgerEntry } from "./operations.types";
import { whatsappState } from "./whatsapp.service";
const DAY = 86400000;
const now = () => new Date().toISOString();
export function loyaltyBalance(ledger: LedgerEntry[]) {
  let debtPoints = 0,
    debtCash = 0;
  const lots = ledger
    .filter((l) => l.kind === "earned")
    .map((l) => {
      const allocations = ledger
        .filter((r) => r.kind === "redeemed")
        .flatMap((r) => r.allocations || [])
        .filter((a) => a.id === l.id);
      const spentPoints = allocations.reduce((n, a) => n + a.points, 0),
        spentCash = allocations.reduce((n, a) => n + a.cashback, 0);
      if (ledger.some((r) => r.kind === "reversed" && r.reference === l.id)) {
        debtPoints += spentPoints;
        debtCash += spentCash;
        return { id: l.id, points: 0, cashback: 0 };
      }
      return {
        id: l.id,
        points: l.expiresAt < now() ? 0 : Math.max(0, l.points - spentPoints),
        cashback: l.expiresAt < now() ? 0 : Math.max(0, l.cashback - spentCash),
      };
    });
  for (const l of ledger.filter((l) => l.kind === "redeemed" && !l.allocations)) {
    debtPoints -= l.points;
    debtCash -= l.cashback;
  }
  return {
    points: Math.max(0, lots.reduce((n, l) => n + l.points, 0) - debtPoints),
    cashback: Math.max(0, lots.reduce((n, l) => n + l.cashback, 0) - debtCash),
    lots,
  };
}
export const normalizePhone = (value: string) => {
  const digits = value.replace(/\D/g, "");
  return digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
};
export function operationsState(db: LaborDatabase) {
  return (db.operations ??= {
    config: { ...DEFAULT_OPERATIONS },
    contacts: [],
    campaigns: [],
    ledger: [],
    readNotifications: [],
    executions: [],
  });
}
export function contactRecord(db: LaborDatabase, phone: string) {
  const s = operationsState(db);
  let contact = s.contacts.find((c) => c.phone === phone);
  if (!contact)
    s.contacts.push((contact = { phone, tags: [], notes: "", consent: [], updatedAt: now() }));
  return contact;
}
export function marketingAllowed(db: LaborDatabase, phone: string) {
  return (
    operationsState(db)
      .contacts.find((c) => c.phone === phone)
      ?.consent.at(-1)?.granted === true
  );
}
function campaignMatches(customer: ReturnType<typeof customers>[number], segment: string, filters?: { minOrders: number; minPaidTotal: number; includeTags: string[]; excludeTags: string[]; favoriteProduct: string }) {
  return (segment === "all" || customer.segments.includes(segment)) &&
    customer.paidOrders >= (filters?.minOrders || 0) &&
    customer.total >= (filters?.minPaidTotal || 0) &&
    (!filters?.includeTags.length || filters.includeTags.some((tag) => customer.tags.includes(tag))) &&
    !filters?.excludeTags.some((tag) => customer.tags.includes(tag)) &&
    (!filters?.favoriteProduct || customer.favorites.includes(filters.favoriteProduct));
}
export function recordOptOut(db: LaborDatabase, phone: string, text: string) {
  if (
    !/^(sair|parar|cancelar mensagens|stop|nao quero promocoes|não quero promoções)[.!\s]*$/i.test(
      text.trim(),
    )
  )
    return false;
  contactRecord(db, phone).consent.push({
    granted: false,
    at: now(),
    evidence: "Solicitação recebida pelo webhook assinado",
    source: "whatsapp",
  });
  for (const job of whatsappState(db).outbound)
    if (job.phone === phone && job.origin === "campaign" && job.state === "queued") {
      job.state = "cancelled";
      job.error = "Cliente solicitou saída das campanhas.";
    }
  return true;
}
export function verifyRecoveryCart(db: LaborDatabase, phone: string, text: string) {
  const match = /^VINCULAR\s+([a-f0-9]{24})$/i.exec(text.trim());
  if (!match) return false;
  const cart = operationsState(db).carts?.find(
    (c) =>
      c.phone === phone &&
      c.code === match[1]!.toLowerCase() &&
      !c.converted &&
      Date.parse(c.at) > Date.now() - 86400000,
  );
  if (!cart) return false;
  cart.verified = true;
  cart.code = "";
  if (cart.consentRequested)
    contactRecord(db, phone).consent.push({
      granted: true,
      at: now(),
      source: "whatsapp verificado",
      evidence: "Cliente marcou autorização no checkout e confirmou código pelo número informado",
    });
  return true;
}
export function customers(db: LaborDatabase) {
  const s = operationsState(db),
    phones = new Set<string>();
  for (const o of db.orders) if (o.customer_phone) phones.add(normalizePhone(o.customer_phone));
  for (const c of db.support?.conversations || [])
    if (c.contact?.phone) phones.add(c.contact.phone);
  for (const c of s.contacts) phones.add(c.phone);
  return [...phones].map((phone) => {
    const orders = db.orders
      .filter((o) => normalizePhone(o.customer_phone) === phone)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
    const conversations = (db.support?.conversations || []).filter(
      (c) => c.contact?.phone === phone,
    );
    const paid = orders.filter(
      (o) => !o.is_test && o.payment_status === "pago" && o.status !== "cancelado",
    );
    const total = paid.reduce((sum, o) => sum + o.total, 0),
      last = paid.at(-1)?.created_at || "";
    const record = s.contacts.find((c) => c.phone === phone);
    const segments = [
      !paid.length
        ? "new"
        : Date.parse(last) < Date.now() - s.config.activeDays * DAY
          ? "inactive"
          : "active",
    ];
    if (paid.length > 1) segments.push("recurring");
    if (total >= s.config.vipTotal && paid.length) segments.push("vip");
    if (paid.some((o) => o.discount > 0)) segments.push("promotion");
    if (
      s.carts?.some(
        (c) =>
          c.phone === phone &&
          c.verified &&
          !c.converted &&
          Date.parse(c.at) < Date.now() - 3600000,
      )
    )
      segments.push("abandoned");
    if (
      db.whatsapp?.drafts?.some(
        (d) => conversations.some((c) => c.id === d.conversationId) && d.state === "pending",
      )
    )
      segments.push("proposal");
    const favorites = new Map<string, number>();
    for (const o of paid)
      for (const p of o.order_items)
        favorites.set(p.product_name, (favorites.get(p.product_name) || 0) + p.quantity);
    const ledger = s.ledger.filter((l) => l.phone === phone);
    const balance = loyaltyBalance(ledger);
    const points = balance.points;
    const cashback = balance.cashback;
    const dates = [
      ...orders.map((o) => o.created_at),
      ...conversations.map((c) => c.createdAt),
    ].sort();
    return {
      id: createHash("sha256")
        .update(`${db.store_id || "acai-labor"}:${phone}`)
        .digest("hex")
        .slice(0, 24),
      phone,
      name: conversations.at(-1)?.contact?.name || orders.at(-1)?.customer_name || phone,
      firstContact: dates[0] || record?.updatedAt || "",
      lastContact:
        [...orders.map((o) => o.created_at), ...conversations.map((c) => c.updatedAt)]
          .sort()
          .at(-1) || "",
      origin: conversations.length ? "whatsapp" : "site",
      orderCount: orders.length,
      paidOrders: paid.length,
      testOrders: orders.filter((o) => o.is_test).length,
      total,
      average: paid.length ? total / paid.length : 0,
      lastPurchase: last,
      favorites: [...favorites]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map((p) => p[0]),
      segments,
      tags: record?.tags || [],
      notes: record?.notes || "",
      consent: record?.consent || [],
      points,
      cashback: cashback / 100,
      orders: orders.map((o) => ({
        id: o.id,
        number: o.order_number,
        status: o.status,
        total: o.total,
        at: o.created_at,
        test: o.is_test,
      })),
      conversations: conversations.map((c) => ({ id: c.id, mode: c.mode, at: c.updatedAt })),
      ledger,
    };
  });
}
export function marketingJobAllowed(
  db: LaborDatabase,
  job: { campaignId?: string; phone: string; id: string },
) {
  const s = operationsState(db),
    campaign = s.campaigns.find((c) => c.id === job.campaignId);
  if (!campaign || campaign.state !== "scheduled" || !marketingAllowed(db, job.phone)) return false;
  return !whatsappState(db).outbound.some(
    (j) =>
      j.id !== job.id &&
      j.phone === job.phone &&
      j.origin === "campaign" &&
      !["failed", "cancelled", "queued"].includes(j.state) &&
      Date.parse(j.createdAt) > Date.now() - s.config.frequencyDays * DAY,
  );
}
export function createOperationsService(deps: LaborDependencies) {
  async function tick() {
    await deps.mutate((db) => {
      const s = operationsState(db),
        wa = whatsappState(db),
        at = now();
      for (const o of db.orders) {
        if (s.config.orderNotifications && o.source === "whatsapp" && wa.config.enabled) {
          const key = `order-status:${o.id}:${o.history.at(-1)?.at}:${o.status}`;
          const c = db.support?.conversations.find(
            (c) =>
              c.channel === "whatsapp" &&
              c.ownerHash === (o as typeof o & { owner?: string }).owner,
          );
          if (
            c?.contact &&
            c.lastInboundAt &&
            Date.parse(c.lastInboundAt) > Date.now() - DAY &&
            !wa.outbound.some((j) => j.key === key)
          ) {
            const labels: Record<string, string> = {
              recebido: "recebido",
              em_preparacao: "em preparação",
              pronto: "pronto",
              saiu_entrega: "saiu para entrega",
              entregue: "entregue",
              concluido: "concluído",
              cancelado: "cancelado",
            };
            wa.outbound.push({
              id: randomUUID(),
              key,
              conversationId: c.id,
              phone: c.contact.phone,
              text: `Pedido #${o.order_number}: ${labels[o.status] || o.status}. Pagamento: ${o.payment_status || "pendente"}.${o.is_test ? " Pedido local de teste, sem cobrança online." : ""}`,
              origin: "order",
              version: c.version,
              createdAt: at,
              dueAt: at,
              attempts: 0,
              state: "queued",
              error: "",
            });
            s.executions.push({ key, at, action: "Aviso de status do pedido colocado na fila" });
          }
        }
        const previous = s.ledger.find((l) => l.orderId === o.id && l.kind === "earned");
        if (!o.is_test && o.payment_status === "pago" && o.status !== "cancelado" && !previous)
          s.ledger.push({
            id: randomUUID(),
            phone: normalizePhone(o.customer_phone),
            orderId: o.id,
            at,
            expiresAt: new Date(Date.now() + s.config.expiryDays * DAY).toISOString(),
            points: Math.floor(o.total * s.config.pointsPerReal),
            cashback: Math.min(
              Math.round(o.total * s.config.cashbackPercent),
              Math.round(s.config.cashbackCap * 100),
            ),
            kind: "earned",
            reference: o.id,
          });
        if (
          previous &&
          (o.status === "cancelado" || o.payment_status === "reembolsado") &&
          !s.ledger.some((l) => l.kind === "reversed" && l.orderId === o.id)
        )
          s.ledger.push({
            ...previous,
            id: randomUUID(),
            at,
            points: previous.expiresAt < at ? 0 : -previous.points,
            cashback: previous.expiresAt < at ? 0 : -previous.cashback,
            kind: "reversed",
            reference: previous.id,
          });
        const key = `pending:${o.id}`;
        if (
          s.config.pendingPaymentMinutes &&
          o.payment_status === "pendente" &&
          !["cancelado", "entregue"].includes(o.status) &&
          Date.parse(o.created_at) < Date.now() - s.config.pendingPaymentMinutes * 60000 &&
          !s.executions.some((e) => e.key === key)
        ) {
          s.executions.push({ key, at, action: "Lembrete interno de pagamento pendente" });
          deps.audit(
            db,
            "automacao.pagamento.pendente",
            o.id,
            `Pedido #${o.order_number} aguarda pagamento`,
          );
        }
      }
      if (s.config.closeInactiveHours)
        for (const c of db.support?.conversations || []) {
          const key = `close:${c.id}`;
          if (
            c.mode !== "closed" &&
            c.mode !== "human" &&
            !c.pending &&
            Date.parse(c.updatedAt) < Date.now() - s.config.closeInactiveHours * 3600000 &&
            !s.executions.some((e) => e.key === key)
          ) {
            c.mode = "closed";
            c.version++;
            s.executions.push({ key, at, action: "Conversa inativa encerrada" });
            deps.audit(
              db,
              "automacao.atendimento.encerrado",
              c.id,
              "Encerramento por inatividade configurada",
            );
          }
        }
      if (!wa.config.enabled) return;
      if (s.recovery?.enabled)
        for (const cart of s.carts || []) {
          const id = cart.id;
          if (
            !cart.verified ||
            cart.converted ||
            Date.parse(cart.at) > Date.now() - s.recovery.hours * 3600000 ||
            s.campaigns.some((c) => c.id === id) ||
            !marketingAllowed(db, cart.phone)
          )
            continue;
          const template = wa.templates.find(
            (t) =>
              t.name === s.recovery!.template &&
              t.language === s.recovery!.language &&
              t.status === "APPROVED" &&
              t.usable &&
              t.variables === 0,
          );
          if (!template) continue;
          s.campaigns.push({
            id,
            name: "Recuperação de carrinho autorizada",
            segment: "abandoned",
            template: template.name,
            language: template.language,
            parameters: [],
            scheduledAt: at,
            state: "scheduled",
            createdAt: at,
            recipients: [cart.phone],
          });
          s.executions.push({
            key: `recovery:${id}`,
            at,
            action: "Recuperação agendada com consentimento e número verificado",
          });
        }
      const list = customers(db);
      for (const campaign of s.campaigns.filter(
        (c) => c.state === "scheduled" && c.scheduledAt <= at,
      )) {
        for (const phone of campaign.recipients) {
          const key = `campaign:${campaign.id}:${phone}`;
          if (wa.outbound.some((j) => j.key === key)) continue;
          const customer = list.find((c) => c.phone === phone),
            conversation = db.support?.conversations
              .filter((c) => c.contact?.phone === phone)
              .at(-1);
          if (!customer || !conversation) continue;
          const parameters = campaign.parameters.map((p) =>
            p
              .replaceAll("{nome}", customer.name)
              .replaceAll("{favorito}", customer.favorites[0] || "cardápio")
              .replaceAll(
                "{ultima_compra}",
                customer.lastPurchase
                  ? new Date(customer.lastPurchase).toLocaleDateString("pt-BR")
                  : "sem compra registrada",
              ),
          );
          const job = {
            id: randomUUID(),
            key,
            conversationId: conversation.id,
            phone,
            text: campaign.name,
            template: { name: campaign.template, language: campaign.language, parameters },
            origin: "campaign" as const,
            version: conversation.version,
            createdAt: at,
            dueAt: at,
            attempts: 0,
            state: "queued" as const,
            error: "",
            campaignId: campaign.id,
            customerId: customer.id,
          };
          if (marketingJobAllowed(db, job)) wa.outbound.push(job);
        }
        const jobs = wa.outbound.filter((j) => j.campaignId === campaign.id);
        if (jobs.length && jobs.every((j) => !["queued", "sending"].includes(j.state))) {
          campaign.state = "complete";
          deps.audit(
            db,
            "campanha.finalizada",
            campaign.id,
            "Fila concluída; métricas de entrega dependem de eventos da Meta",
          );
        }
      }
    });
  }
  return {
    tick,
    async trackCart(owner: string | undefined, input: unknown) {
      if (!owner) throw new Error("Sessão necessária.");
      const data = z
        .object({
          phone: z
            .string()
            .transform(normalizePhone)
            .refine((p) => /^\d{10,15}$/.test(p)),
          products: z
            .array(z.object({ id: z.string().uuid(), quantity: z.number().positive().max(1000) }))
            .min(1)
            .max(40),
          consent: z.literal(true),
        })
        .parse(input);
      return deps.mutate((db) => {
        if (
          data.products.some(
            (p) =>
              !db.products.some((item) => item.id === p.id && item.is_active && !item.is_sold_out),
          )
        )
          throw new Error("Revise os produtos do carrinho.");
        const s = operationsState(db),
          ownerHash = createHash("sha256").update(owner).digest("hex");
        let cart = s.carts?.find((c) => c.ownerHash === ownerHash && !c.converted);
        if (!cart) {
          cart = {
            id: randomUUID(),
            ownerHash,
            phone: data.phone,
            code: randomBytes(12).toString("hex"),
            products: data.products,
            at: now(),
            converted: false,
            verified: false,
            consentRequested: true,
          };
          (s.carts ??= []).push(cart);
        } else {
          cart.products = data.products;
          cart.at = now();
          if (cart.phone !== data.phone) {
            cart.phone = data.phone;
            cart.verified = false;
            cart.code = randomBytes(12).toString("hex");
          }
        }
        return {
          code: cart.code,
          verified: cart.verified,
          businessPhone: (db.whatsapp?.lastTest?.displayPhone || db.store.whatsapp).replace(/\D/g, ""),
        };
      });
    },
    async recoveryConfig(token: string | undefined, input: unknown) {
      deps.requireSensitive(token);
      const data = z
        .object({
          enabled: z.boolean(),
          hours: z.number().int().min(1).max(168),
          template: z.string().max(512),
          language: z.string().max(30),
        })
        .parse(input);
      return deps.mutate((db) => {
        if (
          data.enabled &&
          !whatsappState(db).templates.some(
            (t) =>
              t.name === data.template &&
              t.language === data.language &&
              t.status === "APPROVED" &&
              t.usable &&
              t.variables === 0,
          )
        )
          throw new Error("Selecione template aprovado sem parâmetros para recuperação.");
        operationsState(db).recovery = data;
        deps.audit(
          db,
          "automacao.recuperacao",
          deps.storeId,
          data.enabled ? "Recuperação ativada" : "Recuperação desativada",
        );
        return { ok: true };
      });
    },
    async snapshot(token?: string) {
      deps.requireAdmin(token);
      await tick();
      const db = await deps.read(),
        s = operationsState(db),
        list = customers(db);
      const conversations = db.support?.conversations || [];
      const audit = db.audit || [];
      const times = conversations
        .map((c) => {
          const first = c.messages.find((m) => m.role === "customer"),
            reply =
              first &&
              c.messages.find(
                (m) => (m.role === "assistant" || m.role === "human") && m.at > first.at,
              );
          return first && reply ? (Date.parse(reply.at) - Date.parse(first.at)) / 1000 : null;
        })
        .filter((n): n is number => n !== null);
      return {
        storeId: deps.storeId,
        config: s.config,
        recovery: s.recovery || { enabled: false, hours: 24, template: "", language: "pt_BR" },
        customers: list,
        campaigns: s.campaigns.map((c) => {
          const jobs = whatsappState(db).outbound.filter((j) => j.campaignId === c.id);
          return {
            ...c,
            requested: jobs.length,
            accepted: jobs.filter((j) =>
              ["accepted", "sent", "delivered", "read"].includes(j.state),
            ).length,
            delivered: jobs.filter((j) => ["delivered", "read"].includes(j.state)).length,
            read: jobs.filter((j) => j.state === "read").length,
            failed: jobs.filter((j) => ["failed", "uncertain"].includes(j.state)).length,
            cost: null,
          };
        }),
        notifications: audit
          .filter((e) => /pedido|atendimento|falha|campanha|pagamento/.test(e.action))
          .slice(-100)
          .map((e) => ({ ...e, read: s.readNotifications.includes(e.id) })),
        executions: s.executions.slice(-100),
        reports: {
          conversations: conversations.length,
          automatic: conversations.filter((c) => c.mode === "automatic").length,
          human: conversations.filter((c) => c.mode === "human").length,
          waiting: conversations.filter((c) => c.mode === "waiting").length,
          closed: conversations.filter((c) => c.mode === "closed").length,
          firstResponseSeconds: times.length
            ? times.reduce((a, b) => a + b, 0) / times.length
            : null,
          whatsappOrders: db.orders.filter((o) => o.source === "whatsapp").length,
          siteOrders: db.orders.filter((o) => o.source !== "whatsapp").length,
          paidRevenue: db.orders
            .filter((o) => !o.is_test && o.payment_status === "pago" && o.status !== "cancelado")
            .reduce((sum, o) => sum + o.total, 0),
          testOrders: db.orders.filter((o) => o.is_test).length,
          tokens: db.support?.usage.reduce((sum, u) => sum + u.tokens, 0) || 0,
          errors: db.support?.usage.reduce((sum, u) => sum + u.errors, 0) || 0,
          integrationErrors: whatsappState(db).outbound.filter((j) =>
            ["failed", "uncertain"].includes(j.state),
          ).length,
          recurring: list.filter((c) => c.paidOrders > 1).length,
          aiCost: null,
        },
      };
    },
    async saveConfig(token: string | undefined, input: unknown) {
      deps.requireSensitive(token);
      const config = operationsConfigSchema.parse(input);
      return deps.mutate((db) => {
        operationsState(db).config = config;
        deps.audit(
          db,
          "operacao.configuracao",
          deps.storeId,
          "Regras de relacionamento e automação atualizadas",
        );
        return { ok: true };
      });
    },
    async saveContact(token: string | undefined, input: unknown) {
      deps.requireAdmin(token);
      const data = z
        .object({
          phone: z.string().regex(/^\d{8,15}$/),
          tags: z.array(z.string().trim().min(1).max(30)).max(20),
          notes: z.string().max(3000),
          consent: z.boolean().optional(),
          evidence: z.string().max(500).default(""),
        })
        .parse(input);
      return deps.mutate((db) => {
        const c = contactRecord(db, data.phone);
        if (data.consent && !c.consent.at(-1)?.granted && data.evidence.trim().length < 10)
          throw new Error("Registre origem e evidência da autorização promocional.");
        c.tags = data.tags;
        c.notes = data.notes;
        c.updatedAt = now();
        if (data.consent !== undefined && c.consent.at(-1)?.granted !== data.consent)
          c.consent.push({
            granted: data.consent,
            at: now(),
            evidence: data.evidence,
            source: "registro administrativo",
          });
        deps.audit(
          db,
          "crm.atualizado",
          data.phone,
          "Etiquetas, notas e consentimento atualizados",
        );
        return { ok: true };
      });
    },
    async saveCampaign(token: string | undefined, input: unknown) {
      deps.requireAdmin(token);
      const data = campaignSchema.parse(input);
      return deps.mutate((db) => {
        const s = operationsState(db),
          previous = s.campaigns.find((c) => c.id === data.id);
        if (previous && previous.state !== "draft")
          throw new Error("Só é possível editar rascunhos.");
        const audience = customers(db).filter(
          (c) =>
            marketingAllowed(db, c.phone) &&
            campaignMatches(c, data.segment, data.filters) &&
            c.conversations.length,
        );
        const campaign = {
          ...data,
          state: "draft" as const,
          createdAt: previous?.createdAt || now(),
          recipients: audience.map((c) => c.phone),
        };
        if (previous) Object.assign(previous, campaign);
        else s.campaigns.push(campaign);
        return campaign;
      });
    },
    async campaignAction(token: string | undefined, id: string, action: "confirm" | "pause") {
      deps.requireSensitive(token);
      return deps.mutate((db) => {
        const s = operationsState(db),
          c = s.campaigns.find((c) => c.id === id);
        if (!c) throw new Error("Campanha não encontrada.");
        if (action === "pause") {
          c.state = "paused";
          for (const j of whatsappState(db).outbound)
            if (j.campaignId === id && j.state === "queued") j.state = "cancelled";
        } else {
          if (c.state !== "draft") throw new Error("Crie novo rascunho para novo envio.");
          const wa = whatsappState(db);
          if (!wa.config.enabled) throw new Error("Ative e valide o WhatsApp.");
          const template = wa.templates.find(
            (t) =>
              t.name === c.template &&
              t.language === c.language &&
              t.status === "APPROVED" &&
              t.usable,
          );
          if (
            !template ||
            template.variables !== c.parameters.length ||
            !wa.templatesAt ||
            Date.parse(wa.templatesAt) < Date.now() - DAY
          )
            throw new Error("Sincronize template aprovado e revise parâmetros.");
          const eligible = new Set(customers(db).filter((customer) => campaignMatches(customer, c.segment, c.filters) && customer.conversations.length).map((customer) => customer.phone));
          c.recipients = c.recipients.filter((p) => eligible.has(p) && marketingAllowed(db, p));
          if (!c.recipients.length) throw new Error("Nenhum destinatário autorizado.");
          c.state = "scheduled";
        }
        deps.audit(db, `campanha.${action}`, id, `${c.recipients.length} contatos selecionados`);
        return { ok: true };
      });
    },
    async redeem(
      token: string | undefined,
      phone: string,
      points: number,
      cashback: number,
      reference: string,
    ) {
      deps.requireSensitive(token);
      return deps.mutate((db) => {
        const s = operationsState(db),
          old = s.ledger.find((l) => l.reference === reference && l.kind === "redeemed");
        if (old) {
          if (
            old.phone !== phone ||
            old.points !== -points ||
            old.cashback !== -Math.round(cashback * 100)
          )
            throw new Error("Resgate já utilizado.");
          return old;
        }
        const c = customers(db).find((c) => c.phone === phone);
        if (
          !c ||
          !Number.isSafeInteger(points) ||
          points < 0 ||
          !Number.isFinite(cashback) ||
          cashback < 0 ||
          (!points && !cashback) ||
          points > c.points ||
          cashback > c.cashback
        )
          throw new Error("Saldo insuficiente ou resgate inválido.");
        const entry = {
          id: randomUUID(),
          phone,
          orderId: "",
          at: now(),
          expiresAt: "9999-12-31T00:00:00.000Z",
          points: -points,
          cashback: -Math.round(cashback * 100),
          kind: "redeemed" as const,
          reference,
        };
        const balance = loyaltyBalance(c.ledger);
        let remainingPoints = points,
          remainingCash = Math.round(cashback * 100);
        const allocations = balance.lots
          .map((l) => {
            const p = Math.min(remainingPoints, l.points),
              money = Math.min(remainingCash, l.cashback);
            remainingPoints -= p;
            remainingCash -= money;
            return { id: l.id, points: p, cashback: money };
          })
          .filter((a) => a.points || a.cashback);
        s.ledger.push({ ...entry, allocations });
        deps.audit(
          db,
          "fidelidade.resgate",
          entry.id,
          "Resgate registrado no balcão pelo administrador",
        );
        return entry;
      });
    },
    async readNotification(token: string | undefined, id: string) {
      deps.requireAdmin(token);
      return deps.mutate((db) => {
        const s = operationsState(db);
        if (!s.readNotifications.includes(id)) s.readNotifications.push(id);
        return { ok: true };
      });
    },
  };
}
