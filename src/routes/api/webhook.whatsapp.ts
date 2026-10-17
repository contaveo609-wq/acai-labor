/**
 * WhatsApp Cloud API Webhook Handler
 * Routes: GET /api/webhook/whatsapp  (verification)
 *         POST /api/webhook/whatsapp (incoming messages)
 *
 * This route handles Meta webhook events and dispatches them
 * to the AI processing pipeline securely on the server side.
 *
 * Security:
 * - Signature validation using X-Hub-Signature-256 header
 * - Idempotency via waba_message_id deduplication
 * - No credentials in response bodies or logs
 */

import { createFileRoute } from "@tanstack/react-router";
import { DEMO_MODE } from "@/lib/demo";

export const Route = createFileRoute("/api/webhook/whatsapp")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (DEMO_MODE) {
          const { laborService } = await import("@/lib/labor.service");
          const { startWhatsAppWorker } = await import("@/lib/whatsapp.worker");
          startWhatsAppWorker();
          return laborService.whatsapp.verify(new URL(request.url));
        }
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode") ?? "";
        const token = url.searchParams.get("hub.verify_token") ?? "";
        const challenge = url.searchParams.get("hub.challenge") ?? "";

        if (mode !== "subscribe") {
          return new Response("Forbidden", { status: 403 });
        }

        // Fetch the stored verify token
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: config } = await (supabaseAdmin as any)
            .from("whatsapp_config")
            .select("webhook_verify_token")
            .maybeSingle();

          const expectedToken =
            config?.webhook_verify_token ?? process.env["WHATSAPP_WEBHOOK_VERIFY_TOKEN"];

          if (token === expectedToken) {
            return new Response(challenge, {
              status: 200,
              headers: { "Content-Type": "text/plain" },
            });
          }

          return new Response("Token mismatch", { status: 403 });
        } catch {
          return new Response("Server error", { status: 500 });
        }
      },

      POST: async ({ request }) => {
        if (DEMO_MODE) {
          const { laborService } = await import("@/lib/labor.service");
          const { startWhatsAppWorker } = await import("@/lib/whatsapp.worker");
          startWhatsAppWorker();
          if (Number(request.headers.get("content-length")) > 262144)
            return new Response("Payload too large", { status: 413 });
          const reader = request.body?.getReader();
          const chunks: Uint8Array[] = [];
          let size = 0;
          if (reader) {
            try {
              while (true) {
                const part = await reader.read();
                if (part.done) break;
                size += part.value.length;
                if (size > 262144) return new Response("Payload too large", { status: 413 });
                chunks.push(part.value);
              }
            } finally {
              await reader.cancel();
            }
          }
          const bytes = new Uint8Array(size);
          let offset = 0;
          for (const chunk of chunks) {
            bytes.set(chunk, offset);
            offset += chunk.length;
          }
          return laborService.whatsapp.receive(
            new TextDecoder().decode(bytes),
            request.headers.get("x-hub-signature-256") || "",
          );
        }
        // 1. Validate Meta signature (HMAC-SHA256)
        const rawBody = await request.text();

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          const appSecret = process.env["WHATSAPP_APP_SECRET"];
          if (!appSecret) return new Response("Integração desativada", { status: 503 });

          if (appSecret) {
            const signature = request.headers.get("x-hub-signature-256") ?? "";
            const expectedSig = await computeHmacSha256(appSecret, rawBody);
            if (!signature || signature !== `sha256=${expectedSig}`) {
              console.warn("[Webhook] Signature mismatch — request rejected");
              return new Response("Invalid signature", { status: 403 });
            }
          }

          // 2. Parse payload
          let payload: Record<string, unknown>;
          try {
            payload = JSON.parse(rawBody) as Record<string, unknown>;
          } catch {
            return new Response("Invalid JSON", { status: 400 });
          }

          // 3. Verify it's a WhatsApp Cloud API event
          if ((payload as any)?.object !== "whatsapp_business_account") {
            return new Response("OK", { status: 200 });
          }

          // 4. Extract message entries
          const entries = ((payload as any)?.entry ?? []) as Array<Record<string, unknown>>;

          for (const entry of entries) {
            const changes = ((entry as any)?.changes ?? []) as Array<Record<string, unknown>>;

            for (const change of changes) {
              if ((change as any)?.field !== "messages") continue;

              const value = (change as any)?.value as Record<string, unknown>;
              const messages = ((value as any)?.messages ?? []) as Array<Record<string, unknown>>;

              for (const msg of messages) {
                if ((msg as any)?.type !== "text") continue; // Only handle text messages for now

                const from = (msg as any)?.from as string;
                const messageId = (msg as any)?.id as string;
                const body = (msg as any)?.text?.body as string;
                const name =
                  ((value as any)?.contacts ?? [])?.find(
                    (c: Record<string, unknown>) => (c as any)?.wa_id === from,
                  )?.profile?.name ?? undefined;

                if (!from || !messageId || !body) continue;

                // 5. Dispatch to AI processing (fire and forget to respond 200 quickly)
                const { error: insertError } = await (supabaseAdmin as any)
                  .from("whatsapp_events")
                  .insert({
                    waba_message_id: messageId,
                    from_phone: from,
                    from_name: name ?? null,
                    message_type: "text",
                    message_body: body,
                    status: "received",
                    raw_payload: payload,
                  });
                if (insertError) {
                  console.error("[Webhook] Insert error:", insertError.message);
                }
              }
            }
          }

          // 6. Respond 200 immediately (Meta requires fast response)
          return new Response("EVENT_RECEIVED", { status: 200 });
        } catch (err: unknown) {
          console.error("[Webhook] Unhandled error:", err instanceof Error ? err.message : err);
          return new Response("Server error", { status: 500 });
        }
      },
    },
  },
});

async function computeHmacSha256(secret: string, data: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
