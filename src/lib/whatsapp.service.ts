import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { LaborDatabase } from "./labor.types";
import type { LaborDependencies } from "./labor.dependencies";
import type { createSupportService } from "./support.service";
import { createSupportVault } from "./support.secrets";
import { createWhatsAppTransport, WhatsAppError } from "./whatsapp.transport";
import { marketingJobAllowed, recordOptOut, verifyRecoveryCart } from "./operations.service";
import { laborOrderSchema } from "./labor.schema";
import {
  DEFAULT_WHATSAPP,
  whatsappConfigSchema,
  type WhatsAppSecrets,
  type WhatsAppOutbound,
} from "./whatsapp.types";

const now = () => new Date().toISOString();
const DAY = 86400000;
export function whatsappState(db: LaborDatabase) {
  return (db.whatsapp ??= {
    config: { ...DEFAULT_WHATSAPP },
    revision: 0,
    templates: [],
    inbound: [],
    outbound: [],
    receipts: [],
  });
}
export function validSignature(raw: string, signature: string, secret: string) {
  if (!secret || !/^sha256=[a-f0-9]{64}$/.test(signature)) return false;
  return timingSafeEqual(
    Buffer.from(signature.slice(7), "hex"),
    createHmac("sha256", secret).update(raw).digest(),
  );
}
const messageSchema = z.object({
  id: z.string().min(1).max(200),
  from: z.string().regex(/^\d{8,15}$/),
  timestamp: z.string().regex(/^\d{1,12}$/),
  type: z.string().max(40),
  text: z.object({ body: z.string().max(20000) }).optional(),
  image: z.object({ id: z.string(), caption: z.string().optional() }).optional(),
  audio: z.object({ id: z.string() }).optional(),
  document: z.object({ id: z.string(), caption: z.string().optional() }).optional(),
  interactive: z
    .object({ button_reply: z.object({ id: z.string(), title: z.string() }).optional() })
    .optional(),
});
const payloadSchema = z.object({
  object: z.literal("whatsapp_business_account"),
  entry: z
    .array(
      z.object({
        id: z.string(),
        changes: z
          .array(
            z.object({
              field: z.string(),
              value: z.object({
                metadata: z.object({ phone_number_id: z.string() }),
                contacts: z
                  .array(
                    z.object({
                      wa_id: z.string(),
                      profile: z.object({ name: z.string().max(200) }),
                    }),
                  )
                  .optional(),
                messages: z.array(messageSchema).max(100).optional(),
                statuses: z
                  .array(
                    z.object({
                      id: z.string().max(200),
                      status: z.enum(["sent", "delivered", "read", "failed"]),
                      timestamp: z.string(),
                      biz_opaque_callback_data: z.string().max(200).optional(),
                    }),
                  )
                  .max(100)
                  .optional(),
              }),
            }),
          )
          .max(20),
      }),
    )
    .max(20),
});
const ranks: Record<string, number> = {
  queued: 0,
  sending: 1,
  uncertain: 1,
  accepted: 2,
  sent: 3,
  failed: 3,
  delivered: 4,
  read: 5,
};
function receipt(db: LaborDatabase, id: string, status: string, callback = "") {
  const job = whatsappState(db).outbound.find(
    (j) => j.providerId === id || (!!callback && j.id === callback),
  );
  if (!job || job.state === "cancelled") return;
  if ((ranks[status] || 0) >= (ranks[job.state] || 0)) {
    job.state = status as WhatsAppOutbound["state"];
    job.providerId = id;
    job.error = status === "failed" ? "Meta informou falha de entrega." : "";
  }
  const m = db.support?.conversations
    .find((c) => c.id === job.conversationId)
    ?.messages.find((m) => m.id === job.key);
  if (m) {
    m.delivery = job.state;
    m.providerId = job.providerId;
  }
}
export function createWhatsAppService(
  deps: LaborDependencies,
  support: ReturnType<typeof createSupportService>,
  options: {
    order?: (
      raw: unknown,
      owner: string,
      quote: boolean,
    ) => Promise<{ id: string; order_number: number; total: number; summary: string }>;
    transport?: ReturnType<typeof createWhatsAppTransport>;
    secrets?: { get: () => Promise<string>; replace: (value: string) => Promise<unknown> };
  } = {},
) {
  const vault = options.secrets || createSupportVault(deps.directory, "whatsapp");
  const transport = options.transport || createWhatsAppTransport();
  let running = false,
    recovered = false;
  async function secrets(): Promise<WhatsAppSecrets> {
    const value = await vault.get();
    return value
      ? JSON.parse(value)
      : { token: "", appSecret: "", verifyToken: "", identityKey: "" };
  }
  const owner = (s: WhatsAppSecrets, phone: string) =>
    createHmac("sha256", s.identityKey).update(`${deps.storeId}:${phone}`).digest("hex");
  function enqueue(
    db: LaborDatabase,
    conversationId: string,
    key: string,
    text: string,
    origin: WhatsAppOutbound["origin"],
    template?: WhatsAppOutbound["template"],
  ) {
    const s = whatsappState(db),
      c = db.support?.conversations.find(
        (c) => c.id === conversationId && c.storeId === deps.storeId && c.channel === "whatsapp",
      );
    if (!c?.contact) throw new Error("Conversa WhatsApp não encontrada.");
    const old = s.outbound.find((j) => j.key === key);
    if (old) return old;
    if (!s.config.enabled) throw new Error("WhatsApp desativado.");
    if (!template && (!c.lastInboundAt || Date.parse(c.lastInboundAt) < Date.now() - DAY))
      throw new Error("Janela de 24 horas encerrada. Use um template aprovado.");
    if (template) {
      const approved = s.templates.find(
        (t) =>
          t.name === template.name &&
          t.language === template.language &&
          t.status === "APPROVED" &&
          t.usable,
      );
      if (
        !approved ||
        approved.variables !== template.parameters.length ||
        !s.templatesAt ||
        Date.parse(s.templatesAt) < Date.now() - DAY
      )
        throw new Error("Sincronize um template aprovado e preencha todos os parâmetros.");
    }
    const job: WhatsAppOutbound = {
      id: randomUUID(),
      key,
      conversationId,
      phone: c.contact.phone,
      text: text.slice(0, 4000),
      origin,
      template,
      version: c.version,
      createdAt: now(),
      dueAt: now(),
      attempts: 0,
      state: "queued",
      error: "",
    };
    s.outbound.push(job);
    return job;
  }
  async function runOnce() {
    if (running) return;
    running = true;
    try {
      if (!recovered) {
        await deps.mutate((db) => {
          const s = whatsappState(db);
          for (const j of s.inbound) if (j.state === "processing") j.state = "pending";
          for (const c of db.support?.conversations || [])
            if (c.channel === "whatsapp" && c.pending) {
              const replyTo = c.pending.id;
              c.pending = undefined;
              c.mode = "waiting";
              c.version++;
              c.messages.push({
                id: randomUUID(),
                role: "assistant",
                text: "O atendimento automático foi interrompido. Uma pessoa da loja continuará esta conversa.",
                at: now(),
                replyTo,
              });
            }
          for (const j of s.outbound)
            if (j.state === "sending") {
              j.state = "uncertain";
              j.error =
                "Servidor reiniciado durante envio. Aguarde evento da Meta; não reenviado automaticamente.";
            }
        });
        recovered = true;
      }
      let db = await deps.read();
      if (!whatsappState(db).config.enabled) return;
      const credentials = await secrets();
      if (!credentials.identityKey || !credentials.token) return;
      const incoming = await deps.mutate((db) => {
        const j = whatsappState(db).inbound.find((j) => j.state === "pending" && j.dueAt <= now());
        if (j) {
          j.state = "processing";
          j.attempts++;
        }
        return j ? structuredClone(j) : null;
      });
      if (incoming) {
        try {
          const config = whatsappState(await deps.read()).config;
          const session = owner(credentials, incoming.phone);
          const opened = await support.open(session, {
            phone: incoming.phone,
            name: incoming.name,
            at: incoming.at,
          });
          if (!opened.conversation) throw new Error("Atendimento indisponível.");
          const id = opened.conversation.id;
          await deps.mutate((db) => {
            const j = whatsappState(db).inbound.find((j) => j.id === incoming.id)!;
            j.conversationId = id;
          });
          const confirmation = /^confirmar\s+([a-f0-9]{8})$/i.exec(incoming.text.trim());
          const linked = await deps.mutate((db) =>
            verifyRecoveryCart(db, incoming.phone, incoming.text),
          );
          if (linked) {
            await support.send(session, id, incoming.id, "Vinculação de carrinho autorizada", {
              at: incoming.at,
              humanOnly: true,
            });
            await deps.mutate((db) => {
              enqueue(
                db,
                id,
                `linked:${incoming.id}`,
                "Número confirmado. Você autorizou lembretes deste carrinho. Para cancelar comunicações promocionais, envie SAIR.",
                "order",
              );
              whatsappState(db).inbound.find((j) => j.id === incoming.id)!.state = "done";
            });
          } else if (confirmation && options.order) {
            await support.send(session, id, incoming.id, incoming.text, {
              at: incoming.at,
              humanOnly: true,
            });
            const draft = whatsappState(await deps.read()).drafts?.find(
              (d) => d.conversationId === id && d.code === confirmation[1]!.toLowerCase(),
            );
            let response = "Proposta inexistente ou expirada. Solicite um novo resumo à loja.";
            if (
              draft &&
              draft.state !== "cancelled" &&
              Date.parse(draft.at) > Date.now() - 3600000
            ) {
              try {
                const placed = await options.order(
                  { ...draft.input, expected_total: draft.total },
                  session,
                  false,
                );
                await deps.mutate((db) => {
                  const current = whatsappState(db).drafts!.find((d) => d.id === draft.id)!;
                  current.state = "confirmed";
                  current.orderId = placed.id;
                });
                response = `Pedido #${placed.order_number} registrado. Total R$ ${placed.total.toFixed(2)}. Pagamento pendente. Pedido local de teste, sem cobrança online.`;
              } catch {
                response =
                  "Não foi possível confirmar: disponibilidade, preço ou condições mudaram. A loja precisa revisar e enviar nova proposta.";
              }
            }
            await deps.mutate((db) => {
              const c = db.support!.conversations.find((c) => c.id === id)!;
              const key = `order:${incoming.id}`;
              if (!c.messages.some((m) => m.id === key))
                c.messages.push({ id: key, role: "system", text: response, at: now() });
              enqueue(db, id, key, response, "order");
              whatsappState(db).inbound.find((j) => j.id === incoming.id)!.state = "done";
            });
          } else {
            let media: { mime: string; data: string } | undefined;
            let unsupported = incoming.type !== "text" && incoming.type !== "interactive";
            if (
              incoming.mediaId &&
              config.mediaEnabled &&
              (await deps.read()).support?.config.whatsappGeminiEnabled
            ) {
              try {
                const downloaded = await transport.media(config, credentials, incoming.mediaId);
                media = { mime: downloaded.mime, data: downloaded.bytes.toString("base64") };
                unsupported = false;
              } catch {
                /* Preserve received message for human review. */
              }
            }
            const conversation = await support.send(
              session,
              id,
              incoming.id,
              incoming.text.slice(0, 1000) || `[${incoming.type} recebida]`,
              { at: incoming.at, humanOnly: !config.autoReply || unsupported, media },
            );
            if (unsupported && config.autoReply) await support.handoff(session, id);
            await deps.mutate((db) => {
              const s = whatsappState(db),
                j = s.inbound.find((j) => j.id === incoming.id)!;
              const current = db.support?.conversations.find((c) => c.id === id);
              const customerMessage = current?.messages.find((m) => m.id === incoming.id);
              if (customerMessage && incoming.mediaId)
                customerMessage.attachment = { type: incoming.type, available: true };
              if (
                s.config.autoReply &&
                current?.mode !== "human" &&
                current?.mode !== "closed" &&
                Date.parse(incoming.at) > Date.now() - DAY
              ) {
                const replies = conversation.messages.filter(
                  (m) => m.replyTo === incoming.id && m.role === "assistant",
                );
                for (const m of replies) {
                  const cards = m.cards
                    ?.map(
                      (p) =>
                        `${p.name} — ${p.priceFrom ? "a partir de " : ""}${p.price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}${p.available ? "" : " (indisponível)"}\n${p.description}`,
                    )
                    .join("\n\n");
                  enqueue(
                    db,
                    id,
                    m.id,
                    `${m.text}${cards ? `\n\n${cards}` : ""}${s.config.catalogUrl ? `\n\nCardápio: ${s.config.catalogUrl}` : ""}`,
                    "ai",
                  );
                }
                if (unsupported)
                  enqueue(
                    db,
                    id,
                    `fallback:${incoming.id}`,
                    "Recebi sua mídia. Uma pessoa da loja continuará o atendimento deste formato.",
                    "ai",
                  );
              }
              j.state = "done";
              j.error = "";
            });
          }
        } catch {
          await deps.mutate((db) => {
            const j = whatsappState(db).inbound.find((j) => j.id === incoming.id)!;
            j.state = j.attempts < 4 ? "pending" : "failed";
            j.dueAt = new Date(Date.now() + 60000 * 2 ** j.attempts).toISOString();
            j.error = "Falha ao processar mensagem. Confira atendimento e configuração.";
            deps.audit(db, "whatsapp.recebimento.falha", j.id, j.error);
          });
        }
      }
      // Decrypt before selecting: no asynchronous work separates human-control check from dispatch.
      const job = await deps.mutate((db) => {
        const s = whatsappState(db);
        if (!s.config.enabled) return null;
        const j = s.outbound.find((j) => j.state === "queued" && j.dueAt <= now());
        if (!j) return null;
        const c = db.support?.conversations.find((c) => c.id === j.conversationId);
        if (j.origin === "campaign" && !marketingJobAllowed(db, j)) {
          j.state = "cancelled";
          j.error = "Campanha pausada, saída solicitada ou limite de frequência.";
          return null;
        }
        if (
          !c ||
          (j.origin === "ai" &&
            (!s.config.autoReply ||
              c.version !== j.version ||
              c.mode === "human" ||
              c.mode === "closed"))
        ) {
          j.state = "cancelled";
          return null;
        }
        if (!j.template && (!c.lastInboundAt || Date.parse(c.lastInboundAt) < Date.now() - DAY)) {
          j.state = "failed";
          j.error = "Janela de 24 horas encerrada.";
          return null;
        }
        if (
          j.template &&
          (!s.templatesAt ||
            Date.parse(s.templatesAt) < Date.now() - DAY ||
            !s.templates.some(
              (t) =>
                t.name === j.template!.name &&
                t.language === j.template!.language &&
                t.status === "APPROVED" &&
                t.usable,
            ))
        ) {
          j.state = "failed";
          j.error = "Template precisa ser validado novamente.";
          return null;
        }
        j.state = "sending";
        j.attempts++;
        return { job: structuredClone(j), config: structuredClone(s.config) };
      });
      if (job) {
        try {
          const sent = await transport.send(job.config, credentials, job.job);
          await deps.mutate((db) => {
            const j = whatsappState(db).outbound.find((j) => j.id === job.job.id)!;
            j.providerId = sent.id;
            if (j.state === "sending") j.state = "accepted";
            for (const r of whatsappState(db).receipts.filter(
              (r) => r.id === sent.id || r.callback === j.id,
            ))
              receipt(db, r.id, r.status, r.callback);
            receipt(db, sent.id, j.state, j.id);
          });
        } catch (e) {
          await deps.mutate((db) => {
            const j = whatsappState(db).outbound.find((j) => j.id === job.job.id)!;
            if (j.state !== "sending") return;
            const error =
              e instanceof WhatsAppError
                ? e
                : new WhatsAppError("Falha sem confirmação de envio.", false, true);
            j.state = error.uncertain
              ? "uncertain"
              : error.retryable && j.attempts < 4
                ? "queued"
                : "failed";
            j.dueAt = new Date(Date.now() + 60000 * 2 ** j.attempts).toISOString();
            j.error = error.message;
            deps.audit(db, "whatsapp.envio.falha", j.id, j.error);
          });
        }
      }
    } finally {
      running = false;
    }
  }
  return {
    runOnce,
    async downloadMedia(token: string | undefined, conversationId: string, messageId: string) {
      deps.requireAdmin(token);
      const db = await deps.read(),
        s = whatsappState(db);
      if (
        !db.support?.conversations.some(
          (c) => c.id === conversationId && c.storeId === deps.storeId,
        )
      )
        throw new Error("Conversa não encontrada.");
      const incoming = s.inbound.find(
        (j) => j.id === messageId && j.conversationId === conversationId,
      );
      if (!incoming?.mediaId) throw new Error("Mídia não encontrada ou expirada.");
      const file = await transport.media(s.config, await secrets(), incoming.mediaId);
      return { mime: file.mime, data: file.bytes.toString("base64") };
    },
    async sendMedia(
      token: string | undefined,
      id: string,
      messageId: string,
      input: { mime: string; data: string; name: string },
    ) {
      deps.requireAdmin(token);
      if (input.data.length > 11200000 || !/^[-a-zA-Z0-9+/=]+$/.test(input.data))
        throw new Error("Arquivo inválido ou maior que 8 MB.");
      const db = await deps.read(),
        s = whatsappState(db),
        c = db.support?.conversations.find((c) => c.id === id && c.storeId === deps.storeId);
      if (!c?.contact || c.mode !== "human") throw new Error("Assuma o atendimento.");
      if (!s.config.enabled || !c.lastInboundAt || Date.parse(c.lastInboundAt) < Date.now() - DAY)
        throw new Error("Envio de mídia exige integração ativa e janela de 24 horas aberta.");
      if (s.outbound.some((j) => j.key === messageId)) return { ok: true };
      const bytes = Buffer.from(input.data, "base64");
      const uploaded = await transport.upload(
        s.config,
        await secrets(),
        new Blob([bytes], { type: input.mime }),
        input.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80),
      );
      return deps.mutate((db) => {
        const current = db.support?.conversations.find((c) => c.id === id);
        if (!current || current.mode !== "human" || current.version !== c.version)
          throw new Error("Atendimento alterado durante upload.");
        const name = input.name.slice(0, 80),
          job = enqueue(db, id, messageId, `Arquivo: ${name}`, "human");
        job.media = {
          id: uploaded.id,
          type: input.mime.startsWith("image/")
            ? "image"
            : input.mime.startsWith("audio/")
              ? "audio"
              : "document",
          filename: name,
        };
        if (!current.messages.some((m) => m.id === messageId))
          current.messages.push({
            id: messageId,
            role: "human",
            text: `Arquivo: ${name}`,
            at: now(),
            delivery: "queued",
          });
        return { ok: true };
      });
    },
    async propose(token: string | undefined, id: string, raw: unknown) {
      deps.requireAdmin(token);
      if (!options.order) throw new Error("Pedidos não disponíveis.");
      const db = await deps.read(),
        c = db.support?.conversations.find(
          (c) => c.id === id && c.storeId === deps.storeId && c.channel === "whatsapp",
        );
      if (!c?.contact || c.mode !== "human")
        throw new Error("Assuma o atendimento antes de preparar o pedido.");
      const input = laborOrderSchema.parse({
        ...(raw as object),
        customer_phone: c.contact.phone,
        request_id: randomUUID(),
      });
      const quote = await options.order(input, owner(await secrets(), c.contact.phone), true);
      return deps.mutate((db) => {
        const current = db.support?.conversations.find((c) => c.id === id);
        if (!current || current.mode !== "human" || current.version !== c.version)
          throw new Error("Atendimento alterado; revise a proposta.");
        const s = whatsappState(db),
          draft = {
            id: input.request_id,
            conversationId: id,
            code: randomBytes(4).toString("hex"),
            input,
            total: quote.total,
            summary: quote.summary,
            at: now(),
            state: "pending" as const,
          };
        for (const old of s.drafts || [])
          if (old.conversationId === id && old.state === "pending") old.state = "cancelled";
        (s.drafts ??= []).push(draft);
        const text = `Confira a proposta:\n${quote.summary}\n\nPara confirmar, responda CONFIRMAR ${draft.code}. Válida por 1 hora; preços e disponibilidade serão conferidos novamente.`;
        const key = `draft:${draft.id}`;
        enqueue(db, id, key, text, "human");
        current.messages.push({ id: key, role: "human", text, at: now(), delivery: "queued" });
        deps.audit(
          db,
          "whatsapp.proposta",
          draft.id,
          "Proposta enviada para confirmação explícita do cliente",
        );
        return { id: draft.id, total: draft.total, summary: draft.summary };
      });
    },
    async config(token?: string) {
      deps.requireAdmin(token);
      const s = whatsappState(await deps.read()),
        secret = await secrets();
      return {
        config: s.config,
        lastTest: s.lastTest || null,
        webhookVerifiedAt: s.webhookVerifiedAt || null,
        lastWebhookAt: s.lastWebhookAt || null,
        templatesAt: s.templatesAt || null,
        templates: s.templates,
        hasToken: !!secret.token,
        hasAppSecret: !!secret.appSecret,
        hasVerifyToken: !!secret.verifyToken,
        queue: s.outbound.slice(-100).map((j) => ({
          id: j.id,
          state: j.state,
          error: j.error,
          at: j.createdAt,
          origin: j.origin,
        })),
      };
    },
    async saveConfig(token: string | undefined, input: unknown) {
      deps.requireSensitive(token);
      const config = whatsappConfigSchema.parse(input);
      return deps.mutate((db) => {
        const s = whatsappState(db);
        const changed =
          s.config.phoneId !== config.phoneId ||
          s.config.wabaId !== config.wabaId ||
          s.config.apiVersion !== config.apiVersion;
        if (config.enabled && (changed || !s.lastTest?.ok))
          throw new Error("Salve desativado e teste a conexão antes de ativar.");
        if (changed) {
          s.lastTest = undefined;
          s.webhookVerifiedAt = undefined;
          s.templates = [];
          s.templatesAt = undefined;
          if (s.inbound.length || s.outbound.length)
            throw new Error(
              "Esta loja já possui mensagens. Use outra pasta e identificador para conectar outra conta.",
            );
        }
        s.config = config;
        s.revision++;
        deps.audit(db, "whatsapp.configuracao", deps.storeId, "Configuração atualizada");
        return { ok: true };
      });
    },
    async replaceSecrets(
      token: string | undefined,
      input: {
        token?: string | undefined;
        appSecret?: string | undefined;
        verifyToken?: string | undefined;
      },
    ) {
      deps.requireSensitive(token);
      const values = z
        .object({
          token: z.string().min(20).max(4096).regex(/^\S+$/).optional(),
          appSecret: z.string().min(16).max(200).regex(/^\S+$/).optional(),
          verifyToken: z.string().min(16).max(200).regex(/^\S+$/).optional(),
        })
        .parse(input);
      await deps.mutate(async (db) => {
        const s = whatsappState(db),
          previous = await secrets();
        await vault.replace(
          JSON.stringify({
            ...previous,
            ...values,
            identityKey: previous.identityKey || randomBytes(32).toString("hex"),
          }),
        );
        s.revision++;
        s.lastTest = undefined;
        s.config.enabled = false;
        s.webhookVerifiedAt = undefined;
        deps.audit(db, "whatsapp.segredos", deps.storeId, "Credenciais substituídas no cofre");
      });
      return { ok: true };
    },
    async test(token?: string) {
      deps.requireAdmin(token);
      const s = whatsappState(await deps.read()),
        revision = s.revision;
      let result = { at: now(), ok: false, error: "", displayPhone: "" };
      try {
        const phone = await transport.test(s.config, await secrets());
        result = { ...result, ...phone, ok: true };
      } catch (e) {
        result.error =
          e instanceof WhatsAppError ? e.message : "Não foi possível validar a configuração.";
      }
      return deps.mutate((db) => {
        const s = whatsappState(db);
        if (s.revision !== revision) throw new Error("Configuração alterada durante teste.");
        s.lastTest = result;
        deps.audit(
          db,
          "whatsapp.teste",
          deps.storeId,
          result.ok ? "Conta e telefone validados pela Meta" : result.error,
        );
        return result;
      });
    },
    async syncTemplates(token?: string) {
      deps.requireAdmin(token);
      const s = whatsappState(await deps.read()),
        revision = s.revision;
      const templates = await transport.templates(s.config, await secrets());
      return deps.mutate((db) => {
        const s = whatsappState(db);
        if (s.revision !== revision)
          throw new Error("Configuração alterada durante sincronização.");
        s.templates = templates;
        s.templatesAt = now();
        return templates;
      });
    },
    async reply(
      token: string | undefined,
      id: string,
      messageId: string,
      text: string,
      template?: WhatsAppOutbound["template"],
    ) {
      deps.requireAdmin(token);
      return deps.mutate((db) => {
        const c = db.support?.conversations.find((c) => c.id === id && c.storeId === deps.storeId);
        if (!c || c.mode !== "human") throw new Error("Assuma o atendimento antes de responder.");
        if (!text.trim() || text.length > 1000)
          throw new Error("Mensagem deve ter entre 1 e 1.000 caracteres.");
        const previous = whatsappState(db).outbound.find((j) => j.key === messageId);
        if (previous && previous.text !== text) throw new Error("Identificador já utilizado.");
        const job = enqueue(db, id, messageId, text, "human", template);
        if (!c.messages.some((m) => m.id === messageId))
          c.messages.push({ id: messageId, role: "human", text, at: now(), delivery: job.state });
        c.updatedAt = now();
        deps.audit(db, "whatsapp.resposta", id, "Resposta humana adicionada à fila");
        return { ok: true };
      });
    },
    async verify(url: URL) {
      const s = whatsappState(await deps.read()),
        secret = await secrets();
      if (!secret.verifyToken || !s.config.wabaId)
        return new Response("Integração desativada", { status: 503 });
      const token = url.searchParams.get("hub.verify_token") || "",
        challenge = url.searchParams.get("hub.challenge") || "";
      if (
        url.searchParams.get("hub.mode") !== "subscribe" ||
        Buffer.byteLength(token) !== Buffer.byteLength(secret.verifyToken) ||
        !timingSafeEqual(Buffer.from(token), Buffer.from(secret.verifyToken)) ||
        !/^\d{1,100}$/.test(challenge)
      )
        return new Response("Forbidden", { status: 403 });
      await deps.mutate((db) => {
        whatsappState(db).webhookVerifiedAt = now();
      });
      return new Response(challenge, { headers: { "Content-Type": "text/plain" } });
    },
    async receive(raw: string, signature: string) {
      if (Buffer.byteLength(raw) > 256 * 1024)
        return new Response("Payload too large", { status: 413 });
      const s = whatsappState(await deps.read()),
        secret = await secrets();
      if (!s.config.enabled || !secret.appSecret)
        return new Response("Integração desativada", { status: 503 });
      if (!validSignature(raw, signature, secret.appSecret))
        return new Response("Invalid signature", { status: 403 });
      let payload: z.infer<typeof payloadSchema>;
      try {
        payload = payloadSchema.parse(JSON.parse(raw));
      } catch {
        return new Response("Invalid payload", { status: 400 });
      }
      await deps.mutate((db) => {
        const s = whatsappState(db);
        for (const entry of payload.entry) {
          if (entry.id !== s.config.wabaId) continue;
          for (const change of entry.changes) {
            const v = change.value;
            if (change.field !== "messages" || v.metadata.phone_number_id !== s.config.phoneId)
              continue;
            s.lastWebhookAt = now();
            s.inbound = s.inbound.filter(
              (j) => Date.parse(j.at) > Date.now() - 30 * DAY || j.state === "processing",
            );
            s.receipts = s.receipts.filter((r) => Date.parse(r.at) > Date.now() - 30 * DAY);
            for (const m of v.messages || []) {
              const at = Number(m.timestamp) * 1000;
              if (
                !Number.isFinite(at) ||
                at < Date.now() - 7 * DAY ||
                at > Date.now() + 300000 ||
                s.inbound.some((j) => j.id === m.id)
              )
                continue;
              recordOptOut(db, m.from, m.text?.body || "");
              const media = m.image || m.audio || m.document;
              s.inbound.push({
                id: m.id,
                phone: m.from,
                name: v.contacts?.find((c) => c.wa_id === m.from)?.profile.name || m.from,
                at: new Date(at).toISOString(),
                text:
                  m.text?.body.slice(0, 1000) ||
                  m.interactive?.button_reply?.title.slice(0, 1000) ||
                  `[${m.type} recebida]`,
                type: m.type,
                ...(media ? { mediaId: media.id } : {}),
                state: "pending",
                attempts: 0,
                dueAt: now(),
                error: "",
              });
            }
            for (const r of v.statuses || []) {
              const at = Number(r.timestamp) * 1000;
              if (!Number.isFinite(at) || at < Date.now() - 30 * DAY || at > Date.now() + 300000)
                continue;
              if (!s.receipts.some((old) => old.id === r.id && old.status === r.status))
                s.receipts.push({
                  id: r.id,
                  status: r.status,
                  at: new Date(at).toISOString(),
                  callback: r.biz_opaque_callback_data || "",
                });
              receipt(db, r.id, r.status, r.biz_opaque_callback_data);
            }
          }
        }
      });
      return new Response("EVENT_RECEIVED");
    },
  };
}
