/**
 * Admin data layer — typed wrappers around Supabase queries for new tables.
 *
 * Each function gracefully returns empty data if the table doesn't exist yet
 * (before migration is applied), so the UI never crashes.
 */

import { supabase } from "@/integrations/supabase/client";
import type {
  DeliveryDriver,
  OrderStatusEntry,
  StoreHour,
  Coupon,
  LoyaltyConfig,
  LoyaltyAccount,
  Campaign,
  Review,
  AdminActivityLog,
  AdminNotification,
  AdminUserRecord,
  IAUnresolvedQuery,
  WhatsAppProviderConfig,
} from "./admin-types";

/* ------------------------------------------------------------------ */
/*  Helper: safe query that returns [] on any error                    */
/* ------------------------------------------------------------------ */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAny = any;

async function safeSelect<T>(
  table: string,
  query?: (qb: SupabaseAny) => SupabaseAny,
): Promise<T[]> {
  try {
    let qb = (supabase as SupabaseAny).from(table).select("*");
    if (query) qb = query(qb);
    const { data, error } = await qb;
    if (error) {
      console.warn(`[admin-data] ${table}:`, error.message);
      return [];
    }
    return (data ?? []) as T[];
  } catch {
    return [];
  }
}

async function safeSingle<T>(table: string): Promise<T | null> {
  try {
    const { data, error } = await (supabase as SupabaseAny).from(table).select("*").maybeSingle();
    if (error) return null;
    return data as T | null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Delivery Drivers                                                   */
/* ------------------------------------------------------------------ */

export async function fetchDrivers(): Promise<DeliveryDriver[]> {
  return safeSelect<DeliveryDriver>("delivery_drivers", (q: SupabaseAny) =>
    q.order("name"),
  );
}

export async function createDriver(
  driver: Partial<DeliveryDriver>,
): Promise<DeliveryDriver | null> {
  try {
    const { data, error } = await (supabase as SupabaseAny)
      .from("delivery_drivers")
      .insert(driver)
      .select()
      .single();
    if (error) throw error;
    return data as DeliveryDriver;
  } catch {
    return null;
  }
}

export async function updateDriver(
  id: string,
  patch: Partial<DeliveryDriver>,
): Promise<boolean> {
  try {
    const { error } = await (supabase as SupabaseAny)
      .from("delivery_drivers")
      .update(patch)
      .eq("id", id);
    return !error;
  } catch {
    return false;
  }
}

export async function deleteDriver(id: string): Promise<boolean> {
  try {
    const { error } = await (supabase as SupabaseAny)
      .from("delivery_drivers")
      .delete()
      .eq("id", id);
    return !error;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/*  Order Status History                                               */
/* ------------------------------------------------------------------ */

export async function fetchOrderHistory(orderId: string): Promise<OrderStatusEntry[]> {
  return safeSelect<OrderStatusEntry>("order_status_history", (q: SupabaseAny) =>
    q.eq("order_id", orderId).order("created_at"),
  );
}

export async function addOrderStatusEntry(entry: Partial<OrderStatusEntry>): Promise<boolean> {
  try {
    const { error } = await (supabase as SupabaseAny)
      .from("order_status_history")
      .insert(entry);
    return !error;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/*  Store Hours                                                        */
/* ------------------------------------------------------------------ */

export async function fetchStoreHours(): Promise<StoreHour[]> {
  return safeSelect<StoreHour>("store_hours", (q: SupabaseAny) =>
    q.order("day_of_week").order("open_time"),
  );
}

export async function upsertStoreHour(hour: Partial<StoreHour>): Promise<boolean> {
  try {
    const { error } = await (supabase as SupabaseAny)
      .from("store_hours")
      .upsert(hour);
    return !error;
  } catch {
    return false;
  }
}

export async function deleteStoreHour(id: string): Promise<boolean> {
  try {
    const { error } = await (supabase as SupabaseAny)
      .from("store_hours")
      .delete()
      .eq("id", id);
    return !error;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/*  Coupons                                                            */
/* ------------------------------------------------------------------ */

export async function fetchCoupons(): Promise<Coupon[]> {
  return safeSelect<Coupon>("coupons", (q: SupabaseAny) =>
    q.order("created_at", { ascending: false }),
  );
}

export async function createCoupon(coupon: Partial<Coupon>): Promise<boolean> {
  try {
    const { error } = await (supabase as SupabaseAny).from("coupons").insert(coupon);
    return !error;
  } catch {
    return false;
  }
}

export async function updateCoupon(id: string, patch: Partial<Coupon>): Promise<boolean> {
  try {
    const { error } = await (supabase as SupabaseAny)
      .from("coupons")
      .update(patch)
      .eq("id", id);
    return !error;
  } catch {
    return false;
  }
}

export async function deleteCoupon(id: string): Promise<boolean> {
  try {
    const { error } = await (supabase as SupabaseAny).from("coupons").delete().eq("id", id);
    return !error;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/*  Loyalty                                                            */
/* ------------------------------------------------------------------ */

export async function fetchLoyaltyConfig(): Promise<LoyaltyConfig | null> {
  return safeSingle<LoyaltyConfig>("loyalty_config");
}

export async function updateLoyaltyConfig(patch: Partial<LoyaltyConfig>): Promise<boolean> {
  try {
    const { error } = await (supabase as SupabaseAny)
      .from("loyalty_config")
      .update(patch)
      .eq("id", true);
    return !error;
  } catch {
    return false;
  }
}

export async function fetchLoyaltyAccounts(): Promise<LoyaltyAccount[]> {
  return safeSelect<LoyaltyAccount>("loyalty_accounts", (q: SupabaseAny) =>
    q.order("points_balance", { ascending: false }),
  );
}

/* ------------------------------------------------------------------ */
/*  Campaigns                                                          */
/* ------------------------------------------------------------------ */

export async function fetchCampaigns(): Promise<Campaign[]> {
  return safeSelect<Campaign>("campaigns", (q: SupabaseAny) =>
    q.order("created_at", { ascending: false }),
  );
}

export async function createCampaign(c: Partial<Campaign>): Promise<boolean> {
  try {
    const { error } = await (supabase as SupabaseAny).from("campaigns").insert(c);
    return !error;
  } catch {
    return false;
  }
}

export async function updateCampaign(id: string, patch: Partial<Campaign>): Promise<boolean> {
  try {
    const { error } = await (supabase as SupabaseAny)
      .from("campaigns")
      .update(patch)
      .eq("id", id);
    return !error;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/*  Reviews (Satisfaction)                                              */
/* ------------------------------------------------------------------ */

export async function fetchReviews(): Promise<Review[]> {
  return safeSelect<Review>("reviews", (q: SupabaseAny) =>
    q.order("created_at", { ascending: false }),
  );
}

/* ------------------------------------------------------------------ */
/*  Activity Logs                                                      */
/* ------------------------------------------------------------------ */

export async function fetchActivityLogs(): Promise<AdminActivityLog[]> {
  return safeSelect<AdminActivityLog>("admin_activity_logs", (q: SupabaseAny) =>
    q.order("created_at", { ascending: false }).limit(200),
  );
}

export async function logActivity(entry: Partial<AdminActivityLog>): Promise<void> {
  try {
    await (supabase as SupabaseAny).from("admin_activity_logs").insert(entry);
  } catch {
    // Silently fail — logging should never break the app
  }
}

/* ------------------------------------------------------------------ */
/*  Notifications                                                      */
/* ------------------------------------------------------------------ */

export async function fetchNotifications(): Promise<AdminNotification[]> {
  return safeSelect<AdminNotification>("notifications", (q: SupabaseAny) =>
    q.order("created_at", { ascending: false }).limit(50),
  );
}

export async function markNotificationRead(id: string): Promise<void> {
  try {
    await (supabase as SupabaseAny)
      .from("notifications")
      .update({ is_read: true })
      .eq("id", id);
  } catch {
    // silent
  }
}

/* ------------------------------------------------------------------ */
/*  Admin Users (RBAC)                                                 */
/* ------------------------------------------------------------------ */

export async function fetchAdminUsers(): Promise<AdminUserRecord[]> {
  return safeSelect<AdminUserRecord>("admin_users", (q: SupabaseAny) =>
    q.order("created_at", { ascending: false }),
  );
}

export async function createAdminUser(u: Partial<AdminUserRecord>): Promise<boolean> {
  try {
    const { error } = await (supabase as SupabaseAny).from("admin_users").insert(u);
    return !error;
  } catch {
    return false;
  }
}

export async function updateAdminUser(
  id: string,
  patch: Partial<AdminUserRecord>,
): Promise<boolean> {
  try {
    const { error } = await (supabase as SupabaseAny)
      .from("admin_users")
      .update(patch)
      .eq("id", id);
    return !error;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/*  Order Management (Expanded)                                        */
/* ------------------------------------------------------------------ */

export async function fetchOrderWithDetails(orderId: string): Promise<any | null> {
  try {
    const { data, error } = await (supabase as SupabaseAny)
      .from("orders")
      .select(`
        *,
        order_items(*, order_item_addons(*)),
        order_status_history(*),
        driver_assignments(*, delivery_drivers(*))
      `)
      .eq("id", orderId)
      .maybeSingle();
    if (error) return null;
    return data;
  } catch {
    return null;
  }
}

export async function updateOrderStatus(orderId: string, status: string, changedBy?: string, notes?: string): Promise<boolean> {
  try {
    const { error } = await (supabase as SupabaseAny)
      .from("orders")
      .update({ status })
      .eq("id", orderId);
    if (error) return false;
    
    await (supabase as SupabaseAny)
      .from("order_status_history")
      .insert({ order_id: orderId, status, changed_by: changedBy, notes });
      
    return true;
  } catch {
    return false;
  }
}

export async function assignDriverToOrder(orderId: string, driverId: string): Promise<boolean> {
  try {
    const { error: assignError } = await (supabase as SupabaseAny)
      .from("driver_assignments")
      .insert({ order_id: orderId, driver_id: driverId });
    if (assignError) return false;
    
    await updateOrderStatus(orderId, "saiu_entrega", "admin", "Atribuído a entregador.");
    
    await (supabase as SupabaseAny)
      .from("delivery_drivers")
      .update({ status: "em_entrega" })
      .eq("id", driverId);
      
    return true;
  } catch {
    return false;
  }
}

export async function completeDelivery(orderId: string, driverId: string): Promise<boolean> {
  try {
    await updateOrderStatus(orderId, "entregue", "entregador", "Entrega concluída.");
    
    await (supabase as SupabaseAny)
      .from("driver_assignments")
      .update({ completed_at: new Date().toISOString() })
      .eq("order_id", orderId)
      .eq("driver_id", driverId)
      .is("completed_at", null);
      
    await (supabase as SupabaseAny)
      .from("delivery_drivers")
      .update({ status: "disponivel" })
      .eq("id", driverId);
      
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/*  Notifications (Expanded)                                           */
/* ------------------------------------------------------------------ */

export async function createNotification(type: string, title: string, message: string, link?: string): Promise<void> {
  try {
    await (supabase as SupabaseAny).from("notifications").insert({ type, title, message, link });
  } catch {
    // silent
  }
}

export async function fetchUnreadNotificationCount(): Promise<number> {
  try {
    const { count, error } = await (supabase as SupabaseAny)
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("is_read", false);
    if (error) return 0;
    return count || 0;
  } catch {
    return 0;
  }
}

/* ------------------------------------------------------------------ */
/*  AI Unresolved Queries                                              */
/* ------------------------------------------------------------------ */

export async function fetchIAPendencies(): Promise<IAUnresolvedQuery[]> {
  return safeSelect<IAUnresolvedQuery>("ia_unresolved_queries", (q: SupabaseAny) =>
    q.order("created_at", { ascending: false })
  );
}

export async function resolveIAPendency(id: string, resolvedBy: string): Promise<boolean> {
  try {
    const { error } = await (supabase as SupabaseAny)
      .from("ia_unresolved_queries")
      .update({ status: "resolvido", resolved_at: new Date().toISOString(), resolved_by: resolvedBy })
      .eq("id", id);
    return !error;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/*  WhatsApp Provider Config                                           */
/* ------------------------------------------------------------------ */

export async function fetchWhatsAppProviderConfig(): Promise<WhatsAppProviderConfig | null> {
  return safeSingle<WhatsAppProviderConfig>("whatsapp_provider_config");
}

export async function updateWhatsAppProviderConfig(patch: Partial<WhatsAppProviderConfig>): Promise<boolean> {
  try {
    const { error } = await (supabase as SupabaseAny)
      .from("whatsapp_provider_config")
      .update(patch)
      .eq("id", true);
    return !error;
  } catch {
    return false;
  }
}

