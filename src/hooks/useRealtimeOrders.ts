import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Plays a pleasant order bell chime using the Web Audio API
 */
function playOrderChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    // 3-tone bright chime: C5 (523Hz) -> E5 (659Hz) -> G5 (784Hz)
    const notes = [
      { freq: 523.25, time: 0.0, dur: 0.18 },
      { freq: 659.25, time: 0.16, dur: 0.18 },
      { freq: 783.99, time: 0.32, dur: 0.5 },
    ];

    notes.forEach((note) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(note.freq, ctx.currentTime + note.time);

      gain.gain.setValueAtTime(0.001, ctx.currentTime + note.time);
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + note.time + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + note.time + note.dur);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + note.time);
      osc.stop(ctx.currentTime + note.time + note.dur);
    });
  } catch (err) {
    // Audio context was blocked or not supported
  }
}

export function useRealtimeOrders() {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Request notification permission if not asked yet
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }

    const channel = supabase
      .channel("orders_realtime_stream")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ["orders"] });
          queryClient.invalidateQueries({ queryKey: ["unread_notification_count"] });
          queryClient.invalidateQueries({ queryKey: ["admin_notifications"] });
          queryClient.invalidateQueries({ queryKey: ["admin_stats"] });

          const newOrder = payload.new as any;
          const orderNum = newOrder?.order_number || "Novo";
          const customer = newOrder?.customer_name || "Cliente";
          const totalFormatted = newOrder?.total ? `R$ ${Number(newOrder.total).toFixed(2)}` : "";

          // 1. Play Sound
          playOrderChime();

          // 2. Desktop Notification (if granted)
          if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
            try {
              new Notification(`🔔 Novo Pedido #${orderNum}!`, {
                body: `${customer} • Total: ${totalFormatted}`,
                icon: "/favicon.png",
              });
            } catch (e) {}
          }

          // 3. Screen Toast Notification
          toast.success(`🔔 NOVO PEDIDO #${orderNum}`, {
            description: `${customer} • ${totalFormatted || "Pendente de confirmação"}`,
            duration: 12000,
            action: {
              label: "Ver Pedidos",
              onClick: () => {
                if (window.location.pathname !== "/admin/pedidos") {
                  window.location.href = "/admin/pedidos";
                }
              },
            },
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["orders"] });
          queryClient.invalidateQueries({ queryKey: ["admin_stats"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
