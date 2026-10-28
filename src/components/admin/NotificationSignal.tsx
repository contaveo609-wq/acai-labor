import { useEffect, useRef, useState } from "react";
import type { AuditEvent, LaborOrder } from "@/lib/labor.types";
import { pushInfo, pushSubscribe, pushUnsubscribe } from "@/lib/push.functions";
import { toast } from "sonner";
function decodeKey(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}
export function NotificationSignal({ events, orders }: { events: AuditEvent[]; orders: LaborOrder[] }) {
  const [enabled, setEnabled] = useState(false),
    [error, setError] = useState(""),
    [background, setBackground] = useState(false),
    [pushBusy, setPushBusy] = useState(false);
  const audio = useRef<AudioContext | null>(null),
    seen = useRef(new Set(events.map((e) => e.id)));
  function beep() {
    const context = audio.current;
    if (!context || context.state !== "running") return;
    const wave = context.createOscillator(),
      volume = context.createGain();
    wave.frequency.value = 660;
    volume.gain.value = 0.06;
    wave.connect(volume);
    volume.connect(context.destination);
    wave.start();
    wave.stop(context.currentTime + 0.15);
  }
  useEffect(() => {
    const fresh = events.filter(
      (e) => !seen.current.has(e.id) && /pedido.criado|atendimento.solicitado|falha/.test(e.action),
    );
    seen.current = new Set(events.map((e) => e.id));
    if (enabled && fresh.length) {
      beep();
      if (!background && "Notification" in window && Notification.permission === "granted")
        for (const event of fresh) {
          const order = event.action === "pedido.criado" ? orders.find((item) => item.id === event.resource_id) : undefined;
          const items = order?.order_items.map((item) => `${item.quantity}× ${item.product_name}`).join(", ");
          new Notification(order ? `Novo pedido #${order.order_number}` : "Açaí Labor", {
            body: items?.slice(0, 180) || event.detail.slice(0, 180),
            tag: order ? `order-${order.id}` : event.id,
          });
        }
    }
  }, [events, orders, enabled, background]);
  useEffect(
    () => () => {
      void audio.current?.close();
    },
    [],
  );
  useEffect(() => {
    if ("serviceWorker" in navigator) void navigator.serviceWorker.ready.then((registration) => registration.pushManager?.getSubscription()).then((subscription) => setBackground(!!subscription)).catch(() => {});
  }, []);
  async function toggleBackground() {
    setPushBusy(true);
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window))
        throw new Error("Este navegador não aceita notificações em segundo plano.");
      const registration = await navigator.serviceWorker.ready;
      const current = await registration.pushManager.getSubscription();
      if (background && current) {
        await pushUnsubscribe({ data: { endpoint: current.endpoint } });
        await current.unsubscribe();
        setBackground(false);
        toast.success("Avisos deste aparelho desativados.");
        return;
      }
      if (Notification.permission !== "granted" && await Notification.requestPermission() !== "granted")
        throw new Error("Permita notificações nas configurações do navegador.");
      const { publicKey } = await pushInfo();
      const subscription = current || await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decodeKey(publicKey) });
      const json = subscription.toJSON();
      if (!json.keys?.["p256dh"] || !json.keys["auth"]) throw new Error("O navegador não forneceu chaves de notificação.");
      await pushSubscribe({ data: { endpoint: subscription.endpoint, expirationTime: subscription.expirationTime, keys: { p256dh: json.keys["p256dh"], auth: json.keys["auth"] } } });
      setBackground(true);
      toast.success("Este aparelho receberá novos pedidos, mesmo com a aba fechada.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível ativar os avisos.");
    } finally { setPushBusy(false); }
  }
  return (
    <div>
      <button
        type="button"
        className="text-xs border rounded-lg px-3 py-2"
        onClick={async () => {
          if (enabled) {
            setEnabled(false);
            return;
          }
          try {
            audio.current ??= new AudioContext();
            await audio.current.resume();
            if ("Notification" in window && Notification.permission === "default")
              await Notification.requestPermission();
            setEnabled(true);
            beep();
          } catch {
            setError("Seu navegador não liberou o som. Confira suas permissões.");
          }
        }}
      >
        {enabled ? "Desativar avisos nesta aba" : "Ativar som e avisos nesta aba"}
      </button>
      <button type="button" className="text-xs border rounded-lg px-3 py-2 ml-2" disabled={pushBusy} onClick={() => void toggleBackground()}>
        {pushBusy ? "Configurando…" : background ? "Desativar avisos neste aparelho" : "Receber pedidos neste aparelho"}
      </button>
      {error && <small role="alert">{error}</small>}
    </div>
  );
}
