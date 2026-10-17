import { z } from "zod";
export const operationsConfigSchema = z.object({
  activeDays: z.number().int().min(1).max(365),
  vipTotal: z.number().min(0).max(1000000),
  frequencyDays: z.number().int().min(1).max(365),
  pointsPerReal: z.number().min(0).max(100),
  cashbackPercent: z.number().min(0).max(30),
  cashbackCap: z.number().min(0).max(10000),
  expiryDays: z.number().int().min(1).max(3650),
  closeInactiveHours: z.number().int().min(0).max(720),
  pendingPaymentMinutes: z.number().int().min(0).max(1440),
  notifications: z.boolean(),
  orderNotifications: z.boolean().default(false),
});
export type OperationsConfig = z.infer<typeof operationsConfigSchema>;
export const DEFAULT_OPERATIONS: OperationsConfig = {
  activeDays: 30,
  vipTotal: 500,
  frequencyDays: 7,
  pointsPerReal: 1,
  cashbackPercent: 0,
  cashbackCap: 20,
  expiryDays: 90,
  closeInactiveHours: 0,
  pendingPaymentMinutes: 0,
  notifications: true,
  orderNotifications: false,
};
export type ContactRecord = {
  phone: string;
  tags: string[];
  notes: string;
  consent: Array<{ granted: boolean; at: string; evidence: string; source: string }>;
  updatedAt: string;
};
export type Campaign = {
  id: string;
  name: string;
  segment: string;
  template: string;
  language: string;
  parameters: string[];
  scheduledAt: string;
  state: "draft" | "scheduled" | "paused" | "complete";
  createdAt: string;
  recipients: string[];
  filters?: { minOrders: number; minPaidTotal: number; includeTags: string[]; excludeTags: string[]; favoriteProduct: string } | undefined;
};
export type LedgerEntry = {
  allocations?: Array<{ id: string; points: number; cashback: number }>;
  id: string;
  phone: string;
  orderId: string;
  at: string;
  expiresAt: string;
  points: number;
  cashback: number;
  kind: "earned" | "redeemed" | "reversed";
  reference: string;
};
export type RecoveryCart = {
  id: string;
  ownerHash: string;
  phone: string;
  code: string;
  products: Array<{ id: string; quantity: number }>;
  at: string;
  converted: boolean;
  verified: boolean;
  consentRequested: boolean;
};
export type OperationsState = {
  carts?: RecoveryCart[];
  recovery?: { enabled: boolean; hours: number; template: string; language: string };
  config: OperationsConfig;
  contacts: ContactRecord[];
  campaigns: Campaign[];
  ledger: LedgerEntry[];
  readNotifications: string[];
  executions: Array<{ key: string; at: string; action: string }>;
};
export const campaignSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(100),
  segment: z.enum([
    "all",
    "new",
    "active",
    "recurring",
    "vip",
    "inactive",
    "promotion",
    "abandoned",
    "proposal",
  ]),
  template: z.string().min(1).max(512),
  language: z.string().min(1).max(30),
  parameters: z.array(z.string().max(500)).max(8),
  scheduledAt: z.string().datetime(),
  filters: z.object({
    minOrders: z.number().int().min(0).max(10000),
    minPaidTotal: z.number().min(0).max(1000000),
    includeTags: z.array(z.string().trim().min(1).max(40)).max(10),
    excludeTags: z.array(z.string().trim().min(1).max(40)).max(10),
    favoriteProduct: z.string().max(120),
  }).optional(),
});
