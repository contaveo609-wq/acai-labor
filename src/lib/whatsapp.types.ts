import { z } from "zod";
const httpsUrl = z
  .string()
  .max(300)
  .refine(
    (value) =>
      !value ||
      (() => {
        try {
          const u = new URL(value);
          return (
            u.protocol === "https:" &&
            !u.username &&
            !u.password &&
            !["localhost", "127.0.0.1", "[::1]"].includes(u.hostname)
          );
        } catch {
          return false;
        }
      })(),
    "Use um endereço HTTPS público.",
  );
export const whatsappConfigSchema = z.object({
  enabled: z.boolean(),
  autoReply: z.boolean(),
  wabaId: z.string().regex(/^\d{5,30}$/),
  phoneId: z.string().regex(/^\d{5,30}$/),
  apiVersion: z.string().regex(/^v\d{2}\.0$/),
  webhookUrl: httpsUrl,
  catalogUrl: httpsUrl,
  mediaEnabled: z.boolean().default(false),
});
export type WhatsAppConfig = z.infer<typeof whatsappConfigSchema>;
export const DEFAULT_WHATSAPP: WhatsAppConfig = {
  enabled: false,
  autoReply: false,
  wabaId: "",
  phoneId: "",
  apiVersion: "",
  webhookUrl: "",
  catalogUrl: "",
  mediaEnabled: false,
};
export type WhatsAppSecrets = {
  token: string;
  appSecret: string;
  verifyToken: string;
  identityKey: string;
};
export type WhatsAppTemplate = {
  id: string;
  name: string;
  language: string;
  status: string;
  category: string;
  body: string;
  variables: number;
  usable: boolean;
};
export type WhatsAppInbound = {
  id: string;
  phone: string;
  name: string;
  at: string;
  text: string;
  type: string;
  mediaId?: string;
  mime?: string;
  caption?: string;
  state: "pending" | "processing" | "done" | "failed";
  attempts: number;
  dueAt: string;
  error: string;
  conversationId?: string;
};
export type WhatsAppOutbound = {
  id: string;
  key: string;
  conversationId: string;
  phone: string;
  text: string;
  template?: { name: string; language: string; parameters: string[] } | undefined;
  media?: { id: string; type: "image" | "audio" | "document"; filename: string };
  origin: "ai" | "human" | "campaign" | "automation" | "order";
  version: number;
  createdAt: string;
  dueAt: string;
  attempts: number;
  state:
    | "queued"
    | "sending"
    | "accepted"
    | "sent"
    | "delivered"
    | "read"
    | "failed"
    | "cancelled"
    | "uncertain";
  providerId?: string;
  error: string;
  campaignId?: string;
  customerId?: string;
};
export type WhatsAppState = {
  drafts?: Array<{
    id: string;
    conversationId: string;
    code: string;
    input: import("./labor.schema").LaborOrderInput;
    total: number;
    summary: string;
    at: string;
    state: "pending" | "confirmed" | "cancelled";
    orderId?: string;
  }>;
  config: WhatsAppConfig;
  revision: number;
  lastTest?: { at: string; ok: boolean; error: string; displayPhone: string } | undefined;
  webhookVerifiedAt?: string | undefined;
  lastWebhookAt?: string;
  templatesAt?: string | undefined;
  templates: WhatsAppTemplate[];
  inbound: WhatsAppInbound[];
  outbound: WhatsAppOutbound[];
  receipts: Array<{ id: string; status: string; at: string; callback: string }>;
};
