export function assertLaborRequest(request: Request) {
  const url = new URL(request.url);
  const publicBase = process.env["LABOR_PUBLIC_BASE_URL"];
  if (publicBase) {
    if (url.origin !== new URL(publicBase).origin || url.protocol !== "https:")
      throw new Error("Configure o domínio HTTPS da loja antes de publicar.");
    if (process.env["LABOR_ENCRYPT_DATA"] !== "1")
      throw new Error("Ative a criptografia dos dados antes de publicar.");
    return;
  }
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
    throw new Error("A loja local só aceita acesso neste computador.");
}
