/**
 * Type definitions for the expanded admin panel tables.
 *
 * These types correspond to the new tables created by the admin expansion
 * migration. They are used instead of the auto-generated Supabase types
 * until the types file is regenerated after migration.
 */

export type DriverStatus = "disponivel" | "em_entrega" | "indisponivel";

export type DeliveryDriver = {
  id: string;
  name: string;
  nickname: string | null;
  phone: string;
  whatsapp: string | null;
  photo_url: string | null;
  vehicle: string | null;
  plate: string | null;
  status: DriverStatus;
  is_active: boolean;
  notes: string | null;
  custom_fields: Record<string, any>;
  created_at: string;
  updated_at: string;
};

export type DriverAssignment = {
  id: string;
  order_id: string;
  driver_id: string;
  assigned_at: string;
  completed_at: string | null;
};

export type OrderStatusEntry = {
  id: string;
  order_id: string;
  status: string;
  changed_by: string | null;
  notes: string | null;
  created_at: string;
};

export type StoreHour = {
  id: string;
  day_of_week: number; // 0 = Domingo … 6 = Sábado
  shift_label: string | null;
  open_time: string;
  close_time: string;
  is_active: boolean;
};

export type CouponType = "percentual" | "valor_fixo";

export type Coupon = {
  id: string;
  code: string;
  type: CouponType;
  value: number;
  min_order: number;
  max_discount: number | null;
  max_uses: number | null;
  uses_per_customer: number | null;
  valid_until: string | null;
  product_ids: string[] | null;
  category_ids: string[] | null;
  is_active: boolean;
  total_uses: number;
  created_at: string;
};

export type CouponUsage = {
  id: string;
  coupon_id: string;
  order_id: string;
  customer_phone: string;
  discount_applied: number;
  created_at: string;
};

export type LoyaltyConfig = {
  id: boolean;
  points_per_real: number;
  points_per_order: number;
  reward_description: string;
  points_to_redeem: number;
  reward_value: number;
  is_active: boolean;
  updated_at: string;
};

export type LoyaltyAccount = {
  id: string;
  customer_phone: string;
  customer_name: string;
  points_balance: number;
  total_earned: number;
  total_redeemed: number;
  created_at: string;
};

export type LoyaltyTransaction = {
  id: string;
  account_id: string;
  type: "earn" | "redeem";
  points: number;
  order_id: string | null;
  description: string;
  created_at: string;
};

export type CampaignStatus = "rascunho" | "agendada" | "enviando" | "concluida" | "cancelada";

export type Campaign = {
  id: string;
  name: string;
  message: string;
  audience: string;
  scheduled_at: string | null;
  status: CampaignStatus;
  total_recipients: number;
  sent_count: number;
  created_at: string;
};

export type CampaignRecipient = {
  id: string;
  campaign_id: string;
  customer_phone: string;
  customer_name: string;
  sent_at: string | null;
  status: "pendente" | "enviado" | "falha";
};

export type Review = {
  id: string;
  order_id: string | null;
  customer_name: string;
  customer_phone: string;
  rating: number;
  comment: string | null;
  created_at: string;
};

export type AnalyticsEvent = {
  id: string;
  event_type: string;
  metadata: Record<string, unknown>;
  session_id: string | null;
  created_at: string;
};

export type AdminActivityLog = {
  id: string;
  admin_username: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  details: string | null;
  ip_address: string | null;
  created_at: string;
};

export type AdminNotification = {
  id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  link: string | null;
  created_at: string;
};

export type WhatsAppConfig = {
  id: boolean;
  access_token: string | null;
  phone_number_id: string | null;
  business_account_id: string | null;
  webhook_url: string | null;
  is_active: boolean;
  updated_at: string;
};

export type AdminUserRecord = {
  id: string;
  username: string;
  display_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type IAUnresolvedQuery = {
  id: string;
  customer_name: string;
  customer_phone: string;
  user_message: string;
  bot_response: string;
  status: "pendente" | "resolvido";
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
};

export type WhatsAppProviderConfig = {
  id: boolean;
  provider_name: string;
  endpoint: string | null;
  api_token: string | null;
  webhook_url: string | null;
  phone_number: string | null;
  is_connected: boolean;
  last_tested_at: string | null;
  updated_at: string;
};

/* ------------------------------------------------------------------ */
/*  Day-of-week helpers                                                */
/* ------------------------------------------------------------------ */

export const DAY_LABELS = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
] as const;

export const DAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;
