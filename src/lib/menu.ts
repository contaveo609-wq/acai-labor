import { supabase } from "@/integrations/supabase/client";
import { DEMO_MODE } from "./demo";
import { laborCatalog } from "./labor.functions";

export type ProductImage = { id: string; url: string; sort_order: number; is_primary: boolean };
export type Addon = {
  id: string;
  group_id: string;
  name: string;
  description: string | null;
  price: number;
  is_active: boolean;
  sort_order: number;
};
export type AddonGroup = {
  id: string;
  title: string;
  min_select: number;
  max_select: number;
  is_required: boolean;
  sort_order: number;
  product_addons: Addon[];
};
export type Promotion = {
  id: string;
  title: string | null;
  promo_price: number | null;
  discount_percent: number | null;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
};
export type Product = {
  stock?: Record<string, number>;
  sale_unit?: string;
  min_quantity?: number;
  quantity_step?: number;
  sku?: string;
  sale_options?: Array<{
    id: string;
    label: string;
    unit: string;
    price: number;
    min_quantity: number;
    quantity_step: number;
    is_active: boolean;
  }>;
  id: string;
  category_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  price_from: boolean;
  weight: string | null;
  quantity_label: string | null;
  serves: number | null;
  is_active: boolean;
  is_sold_out: boolean;
  is_featured: boolean;
  featured_order: number;
  sort_order: number;
  product_images: ProductImage[];
  addon_groups: AddonGroup[];
  promotions: Promotion[];
};
export type Category = {
  id: string;
  name: string;
  slug: string;
  emoji: string | null;
  sort_order: number;
  is_active: boolean;
};
export type StoreSettings = {
  primary_color?: string;
  accent_color?: string;
  hero_title?: string;
  hero_description?: string;
  minimum_order?: number;
  delivery_enabled?: boolean;
  pickup_enabled?: boolean;
  scheduling_enabled?: boolean;
  schedule_lead_minutes?: number;
  schedule_days?: number;
  enforce_hours?: boolean;
  weekly_hours?: Array<{ day: number; enabled: boolean; opens: string; closes: string }>;
  store_name: string;
  tagline: string;
  description: string;
  logo_url: string | null;
  banner_url: string | null;
  address_line: string;
  delivery_time_min: number;
  delivery_time_max: number;
  delivery_fee: number;
  whatsapp: string;
  phone: string;
  opening_hours: string;
  is_open: boolean;
};

export const PRODUCT_SELECT =
  "*, product_images(*), addon_groups(*, product_addons(*)), promotions(*)";

export async function fetchCategories(): Promise<Category[]> {
  if (DEMO_MODE) return (await laborCatalog()).categories;
  const { data, error } = await supabase.from("categories").select("*").order("sort_order");
  if (error) throw error;
  return (data ?? []) as Category[];
}

export async function fetchProducts(): Promise<Product[]> {
  if (DEMO_MODE) return (await laborCatalog()).products.map(normalizeProduct);
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .order("sort_order");
  if (error) throw error;
  return ((data ?? []) as unknown as Product[]).map(normalizeProduct);
}

export async function fetchStoreSettings(): Promise<StoreSettings> {
  if (DEMO_MODE) return (await laborCatalog()).store;
  const { data, error } = await supabase.from("store_settings").select("*").maybeSingle();
  if (error) throw error;
  return data as unknown as StoreSettings;
}

function normalizeProduct(p: Product): Product {
  return {
    ...p,
    price: Number(p.price),
    product_images: [...(p.product_images ?? [])].sort((a, b) => a.sort_order - b.sort_order),
    addon_groups: [...(p.addon_groups ?? [])]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((g) => ({
        ...g,
        product_addons: [...(g.product_addons ?? [])]
          .filter((a) => a.is_active)
          .map((a) => ({ ...a, price: Number(a.price) }))
          .sort((a, b) => a.sort_order - b.sort_order),
      })),
    promotions: (p.promotions ?? []).map((pr) => ({
      ...pr,
      promo_price: pr.promo_price === null ? null : Number(pr.promo_price),
      discount_percent: pr.discount_percent === null ? null : Number(pr.discount_percent),
    })),
  };
}

export function activePromotion(product: Product): Promotion | null {
  const now = Date.now();
  const promo = (product.promotions ?? []).find((p) => {
    if (!p.is_active) return false;
    if (p.starts_at && new Date(p.starts_at).getTime() > now) return false;
    if (p.ends_at && new Date(p.ends_at).getTime() < now) return false;
    return p.promo_price !== null || p.discount_percent !== null;
  });
  return promo ?? null;
}

export function effectivePrice(product: Product): number {
  const promo = activePromotion(product);
  if (!promo) return product.price;
  if (promo.promo_price !== null) return promo.promo_price;
  if (promo.discount_percent !== null)
    return Math.round(product.price * (1 - promo.discount_percent / 100) * 100) / 100;
  return product.price;
}

export function primaryImage(product: Product): string | null {
  const imgs = product.product_images ?? [];
  return (imgs.find((i) => i.is_primary) ?? imgs[0])?.url ?? null;
}

export function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function whatsappLink(number: string, message?: string): string {
  const digits = (number || "").replace(/\D/g, "");
  const text = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${digits}${text}`;
}

export const ORDER_STATUS_LABEL: Record<string, string> = {
  recebido: "Recebido",
  confirmado: "Confirmado",
  em_preparacao: "Em preparação",
  pronto: "Pronto",
  saiu_entrega: "Em Entrega",
  entregue: "Entregue",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

export const PAYMENT_LABEL: Record<string, string> = {
  pix: "Pix na entrega/retirada",
  cartao: "Cartão na entrega",
  credito_entrega: "Crédito na entrega/retirada",
  debito_entrega: "Débito na entrega/retirada",
  dinheiro: "Dinheiro",
};
