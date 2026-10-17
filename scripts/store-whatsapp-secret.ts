// Local maintenance: accepts JSON through a hidden terminal, never command-line arguments.
import { createSupportVault } from "../src/lib/support.secrets";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
if (!process.stdin.isTTY) throw new Error("Use um terminal interativo.");
process.stdin.setRawMode(true); process.stdin.resume();
process.stdout.write("Entrada protegida pronta.\n");
let input = "";
process.stdin.on("data", async chunk => {
  const part = chunk.toString();
  if (part.includes("\u0003")) process.exit(1);
  input += part;
  if (!/[\r\n]/.test(input)) return;
  process.stdin.pause();
  try {
    const supplied = JSON.parse(input.trim());
    if (typeof supplied.token !== "string" || supplied.token.length < 20) throw new Error();
    const vault = createSupportVault(resolve(process.env["DEMO_DATA_DIR"] || ".local/labor"), "whatsapp");
    const saved = await vault.get();
    const previous = saved ? JSON.parse(saved) : { token: "", verifyToken: "", appSecret: "" };
    await vault.replace(JSON.stringify({ ...previous, token: supplied.token, ...(supplied.verifyToken ? { verifyToken: supplied.verifyToken } : {}), identityKey: previous.identityKey || randomBytes(32).toString("hex") }));
    process.stdout.write("Credenciais cifradas.\n");
    process.exit(0);
  } catch { process.stdout.write("Não foi possível armazenar credenciais.\n"); process.exit(1); }
});
