import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const url = new URL(request.url);
    const publicBases = [
      process.env["LABOR_PUBLIC_BASE_URL"],
      process.env["VERCEL_URL"] ? `https://${process.env["VERCEL_URL"]}` : undefined,
    ]
      .filter((value): value is string => Boolean(value))
      .map((value) => new URL(value).origin);
    const isVercelHost = url.protocol === "https:" && url.hostname.endsWith(".vercel.app");
    if (publicBases.length && !publicBases.includes(url.origin) && !isVercelHost)
      return new Response("Domínio não autorizado", { status: 421 });
    if (publicBases.length && url.protocol !== "https:")
      return new Response("HTTPS obrigatório", { status: 426 });
    try {
      if (url.pathname === "/api/meta-ads/callback") {
        const cookie = request.headers
          .get("cookie")
          ?.split(";")
          .map((v) => v.trim())
          .find((v) => v.startsWith("labor_ads_oauth="))
          ?.slice(16);
        const { laborService } = await import("./lib/labor.service");
        try {
          await laborService.ads.callback(
            cookie,
            url.searchParams.get("code") || "",
            url.searchParams.get("state") || "",
          );
          return new Response(null, {
            status: 303,
            headers: {
              Location: "/admin/campanhas",
              "Set-Cookie":
                "labor_ads_oauth=; Path=/api/meta-ads/callback; Max-Age=0; HttpOnly; Secure; SameSite=Lax",
              "Cache-Control": "no-store",
              "Referrer-Policy": "no-referrer",
            },
          });
        } catch {
          return new Response(
            "Conexão Meta não concluída. Volte ao painel, confirme MFA e tente novamente.",
            {
              status: 400,
              headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
            },
          );
        }
      }
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      const normalized = await normalizeCatastrophicSsrResponse(response);
      // Responses produced by the Vercel adapter can have immutable headers.
      // Clone before adding security and cache headers.
      const secured = new Response(normalized.body, normalized);
      secured.headers.set("X-Content-Type-Options", "nosniff");
      secured.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
      secured.headers.set("X-Frame-Options", "DENY");
      secured.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
      secured.headers.set(
        "Content-Security-Policy",
        "frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
      );
      if (url.protocol === "https:")
        secured.headers.set("Strict-Transport-Security", "max-age=31536000");
      if (
        url.pathname.startsWith("/admin") ||
        url.pathname.startsWith("/api/") ||
        url.pathname.startsWith("/_server")
      )
        secured.headers.set("Cache-Control", "no-store");
      return secured;
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
