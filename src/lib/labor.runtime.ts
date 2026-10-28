export function assertLaborRequest(request: Request) {
  const url = new URL(request.url);
  const publicBases = [
    process.env["LABOR_PUBLIC_BASE_URL"],
    process.env["VERCEL_URL"] ? `https://${process.env["VERCEL_URL"]}` : undefined,
  ].filter((value): value is string => Boolean(value)).map((value) => new URL(value).origin);
  if (publicBases.length) {
    const isVercelHost = url.protocol === "https:" && url.hostname.endsWith(".vercel.app");
    if ((!publicBases.includes(url.origin) && !isVercelHost) || url.protocol !== "https:")
      throw new Error("Configure o domínio HTTPS da loja antes de publicar.");
    if (process.env["LABOR_STORAGE"] !== "supabase" && process.env["LABOR_ENCRYPT_DATA"] !== "1")
      throw new Error("Ative a criptografia dos dados antes de publicar.");
    return;
  }
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
    throw new Error("A loja local só aceita acesso neste computador.");
}
