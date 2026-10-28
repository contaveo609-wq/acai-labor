import { z } from "zod";

export const supportConfigSchema = z.object({
  name: z.string().trim().min(1).max(60),
  greeting: z.string().trim().min(1).max(500),
  enabled: z.boolean(),
  geminiEnabled: z.boolean(),
  whatsappGeminiEnabled: z.boolean().default(false),
  tone: z.enum(["direto", "acolhedor", "formal"]).default("direto"),
  emojis: z.boolean().default(false),
  businessHoursOnly: z.boolean().default(false),
  handoffUnknown: z.boolean().default(false),
  businessInstructions: z.string().max(1500).default(""),
  prohibitedMessages: z.array(z.string().min(1).max(100)).max(30).default([]),
  model: z.string().regex(/^(|models\/[a-zA-Z0-9._-]+)$/),
  dailyLimit: z.number().int().min(1).max(10000),
  conversationLimit: z.number().int().min(1).max(100),
  siteDailyLimit: z.number().int().min(1).max(10000).default(500),
  siteMinuteLimit: z.number().int().min(1).max(1000).default(10),
  siteConversationLimit: z.number().int().min(1).max(100).default(10),
});
export type SupportConfig = z.infer<typeof supportConfigSchema>;
export const DEFAULT_SUPPORT: SupportConfig = {
  name: "Assistente Labor",
  greeting:
    "Olá! Sou a assistente virtual da Açaí Labor. Posso consultar o cardápio ou chamar alguém da loja.",
  enabled: true,
  geminiEnabled: false,
  whatsappGeminiEnabled: false,
  tone: "direto",
  emojis: false,
  businessHoursOnly: false,
  handoffUnknown: false,
  businessInstructions: "",
  prohibitedMessages: [],
  model: "",
  dailyLimit: 1500,
  conversationLimit: 20,
  siteDailyLimit: 500,
  siteMinuteLimit: 10,
  siteConversationLimit: 10,
};
export const decisionSchema = z
  .object({
    action: z.enum([
      "greeting",
      "products",
      "product",
      "offers",
      "store",
      "cart",
      "order",
      "human",
      "unknown",
    ]),
    query: z.string().max(100).default(""),
    productIds: z.array(z.string().uuid()).max(6).default([]),
    quantity: z.number().positive().max(1000).default(1),
    orderId: z.string().max(50).default(""),
  })
  .strict();
export type SupportDecision = z.infer<typeof decisionSchema>;
export type SupportCard = {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  priceFrom: boolean;
  available: boolean;
  quantity: number;
  canAdd: boolean;
};
export type SupportMessage = {
  id: string;
  role: "customer" | "assistant" | "human" | "system";
  text: string;
  at: string;
  cards?: SupportCard[];
  replyTo?: string;
  delivery?: string;
  providerId?: string | undefined;
  attachment?: { type: string; available: boolean };
};
export type SupportConversation = {
  id: string;
  storeId: string;
  ownerHash: string;
  channel?: "site" | "whatsapp";
  contact?: { phone: string; name: string };
  lastInboundAt?: string;
  createdAt: string;
  updatedAt: string;
  mode: "automatic" | "waiting" | "human" | "closed";
  version: number;
  messages: SupportMessage[];
  requests: number;
  pending?: { id: string; at: string; version: number } | undefined;
  summary: { productIds: string[]; quantity: number; action: string };
};
export type SupportUsage = {
  day: string;
  requests: number;
  siteRequests?: number;
  tokens: number;
  errors: number;
  discarded: number;
};
export type SupportState = {
  config: SupportConfig;
  conversations: SupportConversation[];
  usage: SupportUsage[];
  minuteUsage?: Array<{ minute: string; siteRequests: number }>;
  keyRevision?: number;
  lastTest?: { at: string; ok: boolean; model: string; error: string } | undefined;
};
export type SupportView = Pick<
  SupportConversation,
  "id" | "createdAt" | "updatedAt" | "mode" | "messages"
>;
export type SupportAdminView = SupportView &
  Pick<SupportConversation, "channel" | "contact" | "lastInboundAt">;
