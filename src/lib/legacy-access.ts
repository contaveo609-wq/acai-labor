import { createMiddleware } from "@tanstack/react-start";
import { DEMO_MODE } from "./demo";

/** Guards every legacy administrative RPC before a service-role client is used. */
export const requireLegacyAdmin = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    if (DEMO_MODE) throw new Error("Integrações externas indisponíveis neste ambiente local.");
    const { getRequest } = await import("@tanstack/react-start/server");
    const { createClient } = await import("@supabase/supabase-js");
    const authorization = getRequest().headers.get("authorization") || "";
    if (!authorization.startsWith("Bearer ")) throw new Error("Acesso não autorizado.");
    const url = process.env["SUPABASE_URL"],
      key = process.env["SUPABASE_PUBLISHABLE_KEY"];
    if (!url || !key) throw new Error("Ambiente de autenticação não configurado.");
    const client = createClient(url, key, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: user, error } = await client.auth.getUser(authorization.slice(7));
    if (error || !user.user) throw new Error("Acesso não autorizado.");
    const { data: role, error: roleError } = await client
      .from("user_roles")
      .select("role")
      .eq("user_id", user.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (roleError || !role) throw new Error("Permissão administrativa necessária.");
    return next();
  },
);
