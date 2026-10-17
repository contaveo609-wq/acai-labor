import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { DEMO_MODE } from "./demo";
import { validQuantity, lineCents } from "./vendrex.rules";

export type CartAddon = { id: string; name: string; price: number; quantity: number };
export type CartItem = {
  key: string;
  productId: string;
  slug: string;
  name: string;
  image: string | null;
  unitPrice: number;
  quantity: number;
  notes: string;
  addons: CartAddon[];
  saleOptionId?: string | null;
  saleLabel?: string;
  minQuantity?: number;
  quantityStep?: number;
};

type CartContextValue = {
  items: CartItem[];
  count: number;
  subtotal: number;
  addItem: (item: Omit<CartItem, "key">) => void;
  updateQuantity: (key: string, quantity: number) => void;
  removeItem: (key: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = DEMO_MODE ? "labor-cart-v1" : "skina-cart-v1";

export function itemTotal(item: CartItem): number {
  const addons = item.addons.reduce((sum, a) => sum + Math.round(a.price * 100) * a.quantity, 0);
  return lineCents(Math.round(item.unitPrice * 100) + addons, item.quantity) / 100;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed))
          setItems(
            parsed.filter(
              (i: CartItem) =>
                typeof i.key === "string" &&
                typeof i.productId === "string" &&
                Number.isFinite(i.unitPrice) &&
                i.unitPrice >= 0 &&
                Number.isFinite(i.quantity) &&
                i.quantity > 0 &&
                i.quantity <= 1000 &&
                Array.isArray(i.addons) &&
                i.addons.every(
                  (a) =>
                    Number.isFinite(a.price) &&
                    a.price >= 0 &&
                    Number.isInteger(a.quantity) &&
                    a.quantity > 0,
                ),
            ),
          );
      }
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* ignore */
    }
  }, [items, hydrated]);

  const value = useMemo<CartContextValue>(() => {
    const subtotal = items.reduce((sum, i) => sum + itemTotal(i), 0);
    return {
      items,
      count: items.reduce((sum, i) => sum + i.quantity, 0),
      subtotal,
      addItem: (item) => {
        const signature = `${item.productId}|${item.saleOptionId || "base"}|${item.notes}|${item.addons
          .map((a) => `${a.id}x${a.quantity}`)
          .sort()
          .join(",")}`;
        setItems((prev) => {
          const existing = prev.find((i) => i.key === signature);
          const merged = Math.round(((existing?.quantity || 0) + item.quantity) * 1000) / 1000;
          if (existing && validQuantity(merged, item.minQuantity ?? 1, item.quantityStep ?? 1)) {
            return prev.map((i) =>
              i.key === signature ? { ...item, key: signature, quantity: merged } : i,
            );
          }
          return [
            ...prev,
            { ...item, key: existing ? `${signature}|${crypto.randomUUID()}` : signature },
          ];
        });
      },
      updateQuantity: (key, quantity) =>
        setItems((prev) =>
          quantity <= 0
            ? prev.filter((i) => i.key !== key)
            : prev.map((i) =>
                i.key === key
                  ? {
                      ...i,
                      quantity: validQuantity(
                        Math.round(quantity * 1000) / 1000,
                        i.minQuantity ?? 1,
                        i.quantityStep ?? 1,
                      )
                        ? Math.round(quantity * 1000) / 1000
                        : i.quantity,
                    }
                  : i,
              ),
        ),
      removeItem: (key) => setItems((prev) => prev.filter((i) => i.key !== key)),
      clear: () => setItems([]),
    };
  }, [items]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart deve ser usado dentro de CartProvider");
  return ctx;
}
