import { randomUUID } from "node:crypto";
import webpush from "web-push";
import { createSupportVault } from "./support.secrets";
import type { LaborOrder } from "./labor.types";

type Subscription = { endpoint: string; expirationTime?: number | null | undefined; keys: { p256dh: string; auth: string } };
type Stored = { id: string; subscription: Subscription; createdAt: string };
let queue: Promise<unknown> = Promise.resolve();
function serialize<T>(work: () => Promise<T>): Promise<T> {
  const result = queue.then(work);
  queue = result.catch(() => {});
  return result;
}
function validSubscription(value: Subscription): Subscription {
  const url = new URL(value.endpoint);
  if (url.protocol !== "https:" || !url.hostname || value.endpoint.length > 2048 || url.username || url.password)
    throw new Error("Inscrição de notificação inválida.");
  if (!/^[A-Za-z0-9_-]{40,200}$/.test(value.keys?.p256dh || "") || !/^[A-Za-z0-9_-]{15,100}$/.test(value.keys?.auth || ""))
    throw new Error("Chaves de notificação inválidas.");
  return { endpoint: url.href, expirationTime: value.expirationTime ?? null, keys: { p256dh: value.keys.p256dh, auth: value.keys.auth } };
}
export function createPushService(directory: string) {
  const keys = createSupportVault(directory, "push-vapid");
  const devices = createSupportVault(directory, "push-devices");
  async function vapid() {
    let stored = await keys.get();
    if (!stored) {
      const generated = webpush.generateVAPIDKeys();
      stored = JSON.stringify(generated);
      await keys.replace(stored);
    }
    return JSON.parse(stored) as { publicKey: string; privateKey: string };
  }
  async function list(): Promise<Stored[]> {
    const value = await devices.get();
    return value ? JSON.parse(value) as Stored[] : [];
  }
  return {
    async publicKey() { return (await vapid()).publicKey; },
    async subscribe(raw: Subscription) {
      const subscription = validSubscription(raw);
      return serialize(async () => {
        const current = await list();
        if (!current.some((item) => item.subscription.endpoint === subscription.endpoint)) {
          if (current.length >= 20) throw new Error("Limite de aparelhos atingido.");
          current.push({ id: randomUUID(), subscription, createdAt: new Date().toISOString() });
          await devices.replace(JSON.stringify(current));
        }
        return { ok: true, count: current.length };
      });
    },
    async unsubscribe(endpoint: string) {
      return serialize(async () => {
        const current = await list();
        const remaining = current.filter((item) => item.subscription.endpoint !== endpoint);
        await devices.replace(JSON.stringify(remaining));
        return { ok: true, count: remaining.length };
      });
    },
    async status() { return { count: (await list()).length }; },
    async newOrder(order: LaborOrder) {
      const current = await list();
      if (!current.length) return { sent: 0, failed: 0 };
      const credentials = await vapid();
      webpush.setVapidDetails(process.env["LABOR_VAPID_SUBJECT"] || "mailto:suporte@acailabor.com.br", credentials.publicKey, credentials.privateKey);
      const items = order.order_items.map((item) => `${item.quantity}× ${item.product_name}`).join(", ");
      const payload = JSON.stringify({ title: `Novo pedido #${order.order_number}`, body: items.slice(0, 180), url: "/admin/pedidos", tag: `order-${order.id}` });
      const outcomes = await Promise.allSettled(current.map(async (item) => {
        try {
          await webpush.sendNotification({ ...item.subscription, expirationTime: item.subscription.expirationTime ?? null }, payload, { TTL: 3600, urgency: "high" });
          return { ok: true, stale: false };
        } catch (error) {
          const status = (error as { statusCode?: number }).statusCode;
          return { ok: false, stale: status === 404 || status === 410 };
        }
      }));
      const stale = new Set(current.filter((_, index) => outcomes[index]?.status === "fulfilled" && outcomes[index].value.stale).map((item) => item.id));
      if (stale.size) await serialize(async () => devices.replace(JSON.stringify((await list()).filter((item) => !stale.has(item.id)))));
      const sent = outcomes.filter((value) => value.status === "fulfilled" && value.value.ok).length;
      return { sent, failed: current.length - sent };
    },
  };
}
