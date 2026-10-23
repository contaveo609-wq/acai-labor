// End-to-end checks against a built server and an isolated temporary data directory.
// Does not read/write the user's .local directory and never calls payment services.
import { chromium, expect } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, writeFile, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, dirname } from "node:path";
import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { createServer } from "node:net";

const dir = await mkdtemp(resolve(tmpdir(), "vendrex-browser-"));
const output = resolve("../vendrex-validacao");
await mkdir(output, { recursive: true });
await writeFile(resolve(output, "resultado.json"), JSON.stringify({ status: "running" }));
const seed = JSON.parse(await readFile("tests/fixtures/labor-catalog-v1.json", "utf8"));
const cup = seed.products.find((p) => p.slug === "acai-no-copo-500ml");
cup.sale_options = [
  {
    id: "01234567-1234-4234-8234-123456789012",
    label: "Fardo QA com 6 unidades",
    unit: "fardo",
    price: 50,
    min_quantity: 2,
    quantity_step: 2,
    is_active: true,
  },
];
await writeFile(resolve(dir, "data.json"), JSON.stringify(seed));
const reservation = createServer();
await new Promise((resolve, reject) => {
  reservation.once("error", reject);
  reservation.listen(0, "127.0.0.1", resolve);
});
const freePort = reservation.address().port;
await new Promise((resolve) => reservation.close(resolve));
const port = process.env.VENDREX_TEST_PORT || String(freePort);
const base = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, [".output/server/index.mjs"], {
  env: { ...process.env, GEMINI_API_KEY: "", HOST: "127.0.0.1", PORT: port, DEMO_DATA_DIR: dir },
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true,
});
let logs = "";
server.stdout.on("data", (x) => {
  logs += x;
});
server.stderr.on("data", (x) => {
  logs += x;
});
let browser;
let page;
const errors = [];
const results = [];
let stage = "início";
function watch(p) {
  p.on("pageerror", (e) => {
    const detail = `${stage}: ${p.url()}: ${e.message}`;
    errors.push(detail);
    console.error(detail);
  });
}
async function pass(name, fn) {
  stage = name;
  await fn();
  results.push(name);
  console.log(`PASS: ${name}`);
}
try {
  let ready = false;
  for (let n = 0; n < 60; n++) {
    if (server.exitCode !== null) throw Error(`Server exited: ${logs}`);
    try {
      if (
        logs.includes("Listening on") &&
        (await fetch(base, { signal: AbortSignal.timeout(1000) })).ok
      ) {
        ready = true;
        break;
      }
    } catch {}
    await delay(500);
  }
  assert.ok(ready, "Local test server did not start");
  browser = await chromium.launch({ channel: "msedge", headless: true });
  const customer = await browser.newContext({
    viewport: { width: 1365, height: 900 },
    reducedMotion: "reduce",
  });
  page = await customer.newPage();
  watch(page);
  await pass("cardápio e identidade da Açaí Labor", async () => {
    await page.goto(base);
    await expect(page.getByRole("heading", { name: /Seu dia pede/ })).toBeVisible();
    await expect(page.locator(".product-card").first()).toBeVisible();
    await page.screenshot({ path: resolve(output, "desktop.png"), fullPage: false });
  });
  await pass("PWA instalável e resposta offline sem cache de pedidos", async () => {
    const manifest = await (await fetch(`${base}/manifest.webmanifest`)).json();
    assert.equal(manifest.short_name, "Açaí Labor");
    assert.equal(manifest.display, "standalone");
    assert.equal((await fetch(`${base}/icon-512.png`)).status, 200);
    const worker = await page.evaluate(() =>
      Promise.race([
        navigator.serviceWorker.ready.then((registration) => registration.active?.scriptURL || ""),
        new Promise((resolve) => setTimeout(() => resolve(""), 5000)),
      ]),
    );
    assert.ok(String(worker).endsWith("/sw.js"));
    const source = await (await fetch(`${base}/sw.js`)).text();
    assert.ok(!source.includes("cache.put('/admin"));
    assert.ok(!source.includes("cache.put('/api"));
    const homepage = await fetch(base);
    assert.equal(homepage.headers.get("x-frame-options"), "DENY");
  });
  await pass("embalagem, adicionais, carrinho persistente e checkout", async () => {
    await page.getByLabel("Buscar no catálogo").fill("500");
    await page.locator(".product-card").first().click();
    const modal = page.getByRole("dialog");
    await modal.getByRole("button", { name: /Fardo QA/ }).click();
    await modal.getByRole("button", { name: "Adicionar Banana", exact: true }).click();
    await modal
      .getByRole("textbox", { name: "Observações" })
      .fill("<script>window.qaInjected=true</script>");
    await modal.getByRole("button", { name: /Adicionar •/ }).click();
    await page.getByRole("link", { name: /Abrir carrinho/ }).click();
    await expect(page.getByText("Fardo QA com 6 unidades", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText("Fardo QA com 6 unidades", { exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Finalizar pedido" }).click();
    await page.getByLabel("Seu nome").fill("Cliente QA Vendrex");
    await page.getByLabel("Telefone com DDD").fill("11999990000");
    await page.getByRole("button", { name: "Retirar na loja" }).click();
    await page.getByRole("button", { name: "Débito na entrega/retirada" }).click();
    await page.getByLabel("Tem um cupom?").fill("LABOR10");
    await page.getByRole("button", { name: "Aplicar", exact: true }).click();
    await page.getByRole("button", { name: "Revisar meu pedido" }).click();
    await expect(page.getByText("Confira antes de confirmar")).toBeVisible();
    await page.getByRole("button", { name: "Confirmar pedido de teste" }).click();
    await page.waitForURL(/\/pedido\//);
    await expect(page.getByRole("heading", { name: "#1001" })).toBeVisible();
    await expect(page.getByText("Pagamento pendente", { exact: true })).toBeVisible();
    assert.equal(await page.evaluate(() => window.qaInjected), undefined);
    await expect(page.getByText("R$ 90,00", { exact: true })).toBeVisible();
  });
  const orderUrl = page.url();
  await pass("IDOR: outro visitante não consegue consultar o pedido", async () => {
    const other = await browser.newContext();
    const privatePage = await other.newPage();
    await privatePage.goto(orderUrl);
    await expect(privatePage.getByText("Pedido não encontrado.")).toBeVisible();
    await other.close();
  });
  const admin = await browser.newContext({ viewport: { width: 1365, height: 900 } });
  const panel = await admin.newPage();
  watch(panel);
  await pass("painel exige senha; setup e edição de produto", async () => {
    await panel.goto(`${base}/admin/produtos`);
    await expect(panel.getByRole("button", { name: "Configurar e entrar" })).toBeVisible();
    await panel.getByLabel("Crie uma senha").fill("QA-Only-local#2026");
    await panel.getByLabel("Confirme a senha").fill("QA-Only-local#2026");
    await panel.getByRole("button", { name: "Configurar e entrar" }).click();
    await expect(panel.getByText("Recebimentos confirmados", { exact: true })).toBeVisible();
    await expect(
      panel.getByRole("button", { name: "Receber pedidos neste aparelho" }),
    ).toBeVisible();
    await panel.getByRole("button", { name: "Conversas WhatsApp" }).click();
    await expect(
      panel.getByText("Mensagens recebidas no WhatsApp aparecerão aqui após configurar o webhook."),
    ).toBeVisible();
    await panel.getByRole("button", { name: "Produtos", exact: true }).click();
    await panel.getByLabel("Buscar produto no painel").fill("500");
    await panel.getByRole("button", { name: "Editar", exact: true }).click();
    await panel.getByLabel("SKU", { exact: true }).fill("QA-500");
    await panel.getByRole("button", { name: "Salvar produto", exact: true }).click();
    await expect(panel.getByRole("dialog")).toHaveCount(0);
  });
  await pass("estoque e cadastro de entregador no painel", async () => {
    await panel.getByRole("button", { name: "Estoque", exact: true }).click();
    await expect(panel).toHaveURL(/\/admin\/estoque$/);
    await expect(panel.getByRole("heading", { name: "Estoque" }).last()).toBeVisible();
    await panel.getByLabel("Produto", { exact: true }).selectOption(cup.id);
    await panel.getByLabel("Quantidade disponível").fill("100");
    await panel.getByLabel("Alerta quando chegar a").fill("5");
    await panel.getByRole("button", { name: "Salvar estoque" }).click();
    await expect(panel.getByText(/Atual: 100 · alerta: 5/)).toBeVisible();
    await panel.getByRole("button", { name: "Entregadores", exact: true }).click();
    await panel.getByLabel("Nome", { exact: true }).fill("Entregador QA");
    await panel.getByLabel("Telefone com DDD").fill("11999998888");
    await panel.getByRole("button", { name: "Salvar entregador" }).click();
    await expect(panel.getByText(/Entregador QA · ativo/)).toBeVisible();
  });
  await pass("central: nota interna, impressão, histórico e avanço de etapa", async () => {
    await panel.getByRole("button", { name: "Pedidos", exact: true }).click();
    await panel.getByRole("button", { name: "Abrir pedido #1001" }).click();
    await panel.getByLabel("Nova nota interna").fill("Nota interna QA restrita");
    await panel.getByRole("button", { name: "Adicionar nota", exact: true }).click();
    await expect(
      panel.locator(".order-history p").filter({ hasText: "Nota interna QA restrita" }),
    ).toBeVisible();
    await panel.evaluate(() => {
      window.print = () => {
        window.printCalled = true;
      };
    });
    await panel.getByRole("button", { name: "Imprimir pedido" }).click();
    await expect.poll(() => panel.evaluate(() => window.printCalled)).toBe(true);
    await expect(panel.locator("#vendrex-receipt")).toContainText("NÃO É DOCUMENTO FISCAL");
    await panel.getByRole("button", { name: "Avançar: Em preparação" }).click();
    await expect(panel.getByRole("button", { name: "Avançar: Pronto" })).toBeVisible();
    await page.reload();
    await expect(page.getByText("Em preparação", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Nota interna QA restrita")).toHaveCount(0);
    await panel.getByRole("button", { name: "Close", exact: true }).click();
    await expect(panel.getByRole("dialog")).toHaveCount(0);
    await panel.screenshot({ path: resolve(output, "admin.png"), fullPage: true });
  });
  await pass("configuração visual e regras comerciais persistem", async () => {
    await panel.getByRole("button", { name: "Minha loja", exact: true }).click();
    await panel.getByLabel("Pedido mínimo (R$)", { exact: true }).fill("25");
    await panel.getByLabel("Permitir agendamento", { exact: true }).check();
    await panel
      .getByLabel("Título da página inicial", { exact: true })
      .fill("Seu dia pede um pouco de açaí.");
    await panel.getByRole("button", { name: "Salvar configurações" }).click();
    await expect(panel.getByText("Configurações atualizadas.", { exact: true })).toBeVisible();
    await panel.reload();
    await expect(panel.getByLabel("Pedido mínimo (R$)", { exact: true })).toHaveValue("25");
    await panel.getByRole("button", { name: "Auditoria", exact: true }).click();
    await expect(panel.getByText("loja.salva", { exact: true })).toBeVisible();
  });
  await pass("chat: catálogo, memória persistente e atendimento humano no painel", async () => {
    await page.goto(base);
    await page.getByRole("button", { name: "Ajuda com o catálogo", exact: true }).click();
    const chat = page.getByRole("region", { name: "Atendimento Açaí Labor" });
    await expect(chat.getByText(/Sou a assistente virtual/)).toBeVisible();
    await chat.getByRole("button", { name: "Ofertas", exact: true }).click();
    await expect(chat.locator(".support-product").first()).toBeVisible();
    await chat.getByLabel("Mensagem para atendimento").fill(cup.name);
    await chat.getByRole("button", { name: "Enviar mensagem", exact: true }).click();
    const suggestion = chat.locator(".support-product").filter({ hasText: cup.name }).last();
    await expect(suggestion).toContainText("9,99");
    await suggestion.getByRole("button", { name: /^Adicionar / }).click();
    await expect(chat.getByRole("status")).toContainText("adicionado ao carrinho");
    await suggestion.getByRole("button", { name: "Ver produto e opções" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(
      page.getByRole("dialog").getByRole("button", { name: "Adicionar Banana", exact: true }),
    ).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: "Close", exact: true }).click();
    await page.reload();
    await page.getByRole("button", { name: "Ajuda com o catálogo", exact: true }).click();
    await expect(chat.locator(".support-product").first()).toBeVisible();
    await chat.getByRole("button", { name: "Solicitar atendente" }).click();
    await expect(chat.getByText("Aguardando a loja", { exact: true })).toBeVisible();
    await panel.getByRole("button", { name: "Central de Atendimento", exact: true }).click();
    await panel.locator(".support-conversations > button").first().click();
    await panel.getByRole("button", { name: "Assumir atendimento", exact: true }).click();
    await panel.getByLabel("Resposta ao cliente").fill("Olá, equipe Labor. Como podemos ajudar?");
    await panel.getByRole("button", { name: "Enviar resposta", exact: true }).click();
    await expect(
      chat.getByText("Olá, equipe Labor. Como podemos ajudar?", { exact: true }),
    ).toBeVisible({ timeout: 10000 });
    await chat.getByLabel("Mensagem para atendimento").fill("Obrigado, atendimento confirmado");
    await chat.getByRole("button", { name: "Enviar mensagem", exact: true }).click();
    await expect(
      panel.getByText("Obrigado, atendimento confirmado", { exact: true }).last(),
    ).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: resolve(output, "chat-desktop.png"), fullPage: false });
    await panel.screenshot({ path: resolve(output, "central-atendimento.png"), fullPage: false });
    await panel.getByRole("button", { name: "Encerrar", exact: true }).click();
    await expect(chat.getByRole("button", { name: "Iniciar nova conversa" })).toBeVisible({
      timeout: 10000,
    });
    await panel.getByRole("button", { name: "Inteligência Artificial", exact: true }).click();
    await expect(panel.getByText("Nenhuma chave configurada.", { exact: true })).toBeVisible();
    await expect(panel.getByLabel("Ativar Gemini no site", { exact: true })).toBeDisabled();
    await panel
      .getByLabel("Mensagem de boas-vindas")
      .fill("Olá, sou a assistente virtual da Açaí Labor. Boas-vindas de teste.");
    await panel.getByRole("button", { name: "Salvar preferências", exact: true }).click();
    await expect(panel.getByText("Preferências salvas.", { exact: true })).toBeVisible();
    await chat.getByRole("button", { name: "Iniciar nova conversa" }).click();
    await expect(chat.getByText(/Boas-vindas de teste/)).toBeVisible();
    await chat.getByRole("button", { name: "Minimizar atendimento" }).click();
  });
  await pass("smartphone: catálogo, personalização e ausência de rolagem horizontal", async () => {
    const mobile = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 1,
      reducedMotion: "reduce",
    });
    const phone = await mobile.newPage();
    watch(phone);
    await phone.goto(base);
    await expect(phone.locator(".product-card").first()).toBeVisible();
    await phone.getByRole("button", { name: "Ajuda com o catálogo", exact: true }).click();
    const chat = phone.getByRole("region", { name: "Atendimento Açaí Labor" });
    await expect(chat.getByText(/Boas-vindas de teste/)).toBeVisible();
    await expect(chat.getByText("Obrigado, atendimento confirmado")).toHaveCount(0);
    await chat.getByRole("button", { name: "Entrega", exact: true }).click();
    await expect(chat.getByText(/taxa cadastrada/)).toBeVisible();
    const bounds = await chat.boundingBox();
    assert.ok(
      bounds &&
        bounds.x >= 0 &&
        bounds.y >= 0 &&
        bounds.x + bounds.width <= 390 &&
        bounds.y + bounds.height <= 844,
    );
    await phone.screenshot({ path: resolve(output, "chat-mobile.png"), fullPage: false });
    await chat.getByRole("button", { name: "Minimizar atendimento" }).click();
    await phone.screenshot({ path: resolve(output, "mobile.png"), fullPage: false });
    assert.ok(
      await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      "Mobile overflow",
    );
    await phone.getByLabel("Buscar no catálogo").fill("300");
    await phone.locator(".product-card").first().click();
    await expect(phone.getByRole("dialog")).toBeVisible();
    await phone.getByRole("button", { name: /Adicionar •/ }).click();
    await phone.getByRole("link", { name: /Abrir carrinho/ }).click();
    await phone.getByRole("link", { name: "Finalizar pedido" }).click();
    await expect(phone.getByRole("button", { name: "Revisar meu pedido" })).toBeDisabled();
    await expect(phone.getByRole("alert").filter({ hasText: "Mínimo de" })).toBeVisible();
    await mobile.close();
  });
  await pass("CRM, campanhas, fidelidade, automações e relatórios locais", async () => {
    const operation = await admin.newPage();
    watch(operation);
    for (const [route, label] of [
      ["clientes", "Histórico da loja"],
      ["campanhas", "Central de tráfego pago"],
      ["fidelidade", "Histórico da loja"],
      ["automacoes", "Recuperação de carrinhos"],
      ["relatorios", "Receita real paga"],
      ["notificacoes", "Eventos persistidos"],
      ["integracoes", "WhatsApp Business Platform"],
      ["whatsapp", "Conexão ainda não validada"],
    ]) {
      await operation.goto(`${base}/admin/${route}`);
      await expect(operation.getByText(label, { exact: false }).first()).toBeVisible();
      assert.ok(
        await operation.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        `Overflow admin ${route}`,
      );
      await operation.screenshot({ path: resolve(output, `admin-${route}.png`), fullPage: false });
    }
    await operation.setViewportSize({ width: 390, height: 844 });
    for (const route of ["clientes", "whatsapp", "relatorios"]) {
      await operation.goto(`${base}/admin/${route}`);
      await expect(operation.locator(".labor-admin-main")).toBeVisible();
      const fits = await operation.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      );
      if (!fits) {
        await operation.screenshot({
          path: resolve(output, `overflow-${route}.png`),
          fullPage: false,
        });
        console.error(
          await operation.evaluate(() =>
            Array.from(document.querySelectorAll("body *"))
              .filter(
                (el) =>
                  el.getBoundingClientRect().right > innerWidth + 1 &&
                  getComputedStyle(el).position !== "fixed",
              )
              .slice(0, 15)
              .map((el) => ({
                tag: el.tagName,
                class: el.className,
                width: el.getBoundingClientRect().width,
              })),
          ),
        );
      }
      assert.ok(fits, `Overflow mobile admin ${route}`);
      await operation.screenshot({
        path: resolve(output, `admin-${route}-mobile.png`),
        fullPage: false,
      });
    }
    await operation.close();
  });
  await pass("tráfego pago: rascunho real e campanhas WhatsApp preservadas", async () => {
    await panel.goto(`${base}/admin/campanhas`);
    await expect(panel.getByRole("heading", { name: "Central de tráfego pago" })).toBeVisible();
    await panel.getByRole("button", { name: "Criar campanha", exact: true }).click();
    await panel.getByLabel("Nome", { exact: true }).fill("Campanha QA sem envio Meta");
    await panel.getByLabel("Produto", { exact: true }).selectOption(cup.id);
    await panel.getByRole("button", { name: "Salvar rascunho", exact: true }).click();
    await expect(panel.getByText("Operação concluída.", { exact: true })).toBeVisible();
    await panel.getByRole("button", { name: "Minhas campanhas", exact: true }).click();
    await expect(panel.getByRole("heading", { name: "Campanha QA sem envio Meta" })).toBeVisible();
    await panel.screenshot({ path: resolve(output, "trafego-pago.png"), fullPage: true });
    await panel.getByRole("button", { name: "Campanhas WhatsApp", exact: true }).click();
    await expect(panel.getByText(/Somente contatos com autorização/)).toBeVisible();
  });
  await pass("webhook sem credenciais rejeita eventos", async () => {
    assert.equal(
      (await fetch(`${base}/api/webhook/whatsapp`, { method: "POST", body: "{}" })).status,
      503,
    );
  });
  assert.deepEqual(errors, [], "Uncaught browser errors");
  await writeFile(
    resolve(output, "resultado.json"),
    JSON.stringify(
      { status: "passed", passed: results.length, results, browserErrors: errors },
      null,
      2,
    ),
  );
  console.log(`UI: ${results.length} checks passed. Screenshots: ${output}`);
} catch (error) {
  await writeFile(
    resolve(output, "resultado.json"),
    JSON.stringify(
      { status: "failed", completed: results, browserErrors: errors, error: String(error) },
      null,
      2,
    ),
  );
  if (page)
    await page.screenshot({ path: resolve(output, "falha.png"), fullPage: true }).catch(() => {});
  console.error(error);
  console.error(logs.slice(-3000));
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  if (server.exitCode === null && server.signalCode === null) {
    const exited = new Promise((resolve) => server.once("exit", resolve));
    server.kill();
    await exited;
  }
  assert.equal(dirname(dir), resolve(tmpdir()));
  await rm(dir, { recursive: true, force: true });
}
