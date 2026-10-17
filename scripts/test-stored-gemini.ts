import { resolve } from "node:path";
import { createGeminiProvider } from "../src/lib/support.gemini";
import { createSupportVault } from "../src/lib/support.secrets";
const key = await createSupportVault(resolve(process.env["DEMO_DATA_DIR"] || ".local/labor"), "gemini").get();
if (!key) throw new Error("Chave ausente.");
const provider = createGeminiProvider(async () => key);
try {
  const result = await provider.decide({ model: "models/gemini-3.5-flash-lite", context: JSON.stringify({ messages: [{ role: "customer", text: "Quais açaís vocês têm?" }], products: [] }) });
  process.stdout.write(JSON.stringify({ ok: true, model: "models/gemini-3.5-flash-lite", action: result.decision.action, tokens: result.tokens, requests: 1 }) + "\n");
} catch (error) {
  process.stdout.write(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : "Falha", requests: 1 }) + "\n");
  process.exitCode = 1;
}
