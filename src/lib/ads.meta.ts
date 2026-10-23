import { createHmac } from "node:crypto";
import { z } from "zod";
export function metaConfig() {
  const version = process.env["META_ADS_API_VERSION"];
  if (!version || !/^v\d+\.0$/.test(version))
    throw new Error("Configure META_ADS_API_VERSION com versão suportada pelo aplicativo Meta.");
  return {
    version,
    appId: process.env["META_ADS_APP_ID"] || "",
    appSecret: process.env["META_ADS_APP_SECRET"] || "",
    redirect: process.env["META_ADS_REDIRECT_URI"] || "",
  };
}
export function createAdsTransport(request: typeof fetch = fetch) {
  return async function call(
    path: string,
    token: string,
    params: Record<string, unknown> = {},
    method = "GET",
  ) {
    const c = metaConfig();
    if (!/^[\w/]+$/.test(path)) throw new Error("Recurso Meta inválido.");
    const url = new URL(`https://graph.facebook.com/${c.version}/${path}`);
    const values = new URLSearchParams();
    for (const [key, value] of Object.entries(params))
      values.set(key, typeof value === "object" ? JSON.stringify(value) : String(value));
    if (c.appSecret && token)
      values.set("appsecret_proof", createHmac("sha256", c.appSecret).update(token).digest("hex"));
    if (method === "GET") url.search = values.toString();
    let response: Response;
    try {
      response = await request(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(method !== "GET" ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
        },
        ...(method !== "GET" ? { body: values } : {}),
        signal: AbortSignal.timeout(20000),
        redirect: "error",
      });
    } catch {
      throw new Error("Meta indisponível; confira resultado antes de repetir alterações.");
    }
    if (!response.ok)
      throw new Error(
        response.status === 429
          ? "Limite da Meta atingido. Aguarde antes de sincronizar."
          : `Operação Meta recusada (HTTP ${response.status}). Confira permissões e conta.`,
      );
    return response.json() as Promise<Record<string, unknown>>;
  };
}
export const accountDTO = z.object({
  id: z.string().regex(/^act_\d+$/),
  name: z.string(),
  currency: z.string().length(3),
});
export const campaignDTO = z.object({
  id: z.string().regex(/^\d+$/),
  name: z.string(),
  status: z.string(),
  objective: z.string(),
});
