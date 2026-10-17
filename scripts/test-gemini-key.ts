// Local maintenance. Reads the key from hidden terminal input, never from arguments.
import { resolve } from "node:path";
import { createGeminiProvider } from "../src/lib/support.gemini";
import { createSupportVault } from "../src/lib/support.secrets";

if (!process.stdin.isTTY || !process.stdin.setRawMode) throw new Error("Use terminal interativo.");
process.stdin.setRawMode(true);
process.stdin.resume();
process.stdout.write("Cole a chave Gemini e pressione Enter. Entrada oculta.\n");
let input = "";
process.stdin.on("data", async (chunk) => {
  const part = chunk.toString();
  if (part.includes("\u0003")) process.exit(1);
  input += part;
  if (!/[\r\n]/.test(input)) return;
  process.stdin.pause();
  const key = input.trim();
  input = "";
  if (key.length < 20 || key.length > 250) { process.stdout.write("Formato da chave inválido.\n"); process.exit(1); }
  let requests = 0;
  const provider = createGeminiProvider(async () => key, (url, options) => {
    if (requests >= 5) throw new Error("Limite de cinco testes atingido.");
    requests++;
    return fetch(url, options);
  });
  try {
    const models = await provider.models();
    const model = models.find((item) => item.name === "models/gemini-3.5-flash-lite") || models.find((item) => item.name === "models/gemini-3.8-flash") || models.find((item) => /flash-lite|flash/.test(item.name) && !/image|tts|live/.test(item.name));
    if (!model) throw new Error("Nenhum modelo de texto Flash disponível nesta conta.");
    await createSupportVault(resolve(process.env["DEMO_DATA_DIR"] || ".local/labor"), "gemini").replace(key);
    const result = await provider.decide({ model: model.name, context: JSON.stringify({ messages: [{ role: "customer", text: "Quais açaís vocês têm?" }], products: [] }) });
    process.stdout.write(JSON.stringify({ ok: true, requests, model: model.name, action: result.decision.action, availableModels: models.length }) + "\n");
    process.exit(0);
  } catch (error) {
    process.stdout.write(JSON.stringify({ ok: false, requests, error: error instanceof Error ? error.message : "Falha de conexão" }) + "\n");
    process.exit(1);
  }
});
