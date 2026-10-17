import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { createLaborService } from "../src/lib/labor.service";
import { totp } from "../src/lib/security.service";
import { couponDiscount } from "../src/lib/coupons";
import {
  loyaltyBalance,
  verifyRecoveryCart,
  operationsState,
  marketingAllowed,
} from "../src/lib/operations.service";
import { couponSchema } from "../src/lib/coupons";
import type { LedgerEntry } from "../src/lib/operations.types";
import seed from "./fixtures/labor-catalog-v1.json";
async function fixture(t: Parameters<Parameters<typeof test>[1]>[0]) {
  const directory = await mkdtemp(join(tmpdir(), "labor-operations-"));
  t.after(async () => {
    assert.equal(dirname(directory), tmpdir());
    await rm(directory, { recursive: true, force: true });
  });
  const service = createLaborService(directory, seed);
  const token = await service.login("Operations-test#2026", true);
  const cup = seed.products.find((p) => p.slug === "acai-no-copo-500ml")!;
  const input = () => ({
    customer_name: "Cliente Teste",
    customer_phone: "11999990000",
    fulfillment: "pickup",
    street: "",
    number: "",
    neighborhood: "",
    payment_method: "pix",
    request_id: randomUUID(),
    items: [{ product_id: cup.id, quantity: 2, addons: [] }],
  });
  return { directory, service, token, input };
}
test("MFA protege credenciais, bloqueia replay e códigos de recuperação são de uso único", async (t) => {
  const h = await fixture(t);
  await assert.rejects(
    h.service.whatsapp.replaceSecrets(h.token, { token: "fake-test-token-long" }),
    /MFA/,
  );
  const enrollment = await h.service.security.begin(h.token, "Operations-test#2026");
  const enrollmentCode = totp(enrollment.secret);
  const result = await h.service.security.confirm(h.token, enrollmentCode, true);
  assert.equal(result.recoveryCodes.length, 8);
  await assert.rejects(
    h.service.security.confirm(h.token, enrollmentCode),
    /já utilizado/,
  );
  await h.service.security.confirm(h.token, result.recoveryCodes[0]!);
  await assert.rejects(
    h.service.security.confirm(h.token, result.recoveryCodes[0]!),
    /já utilizado/,
  );
  await h.service.whatsapp.replaceSecrets(h.token, { token: "fake-test-token-long" });
  const raw = await readFile(join(h.directory, "whatsapp-secret.json"), "utf8");
  assert.ok(!raw.includes("fake-test-token-long"));
  const config = await h.service.whatsapp.config(h.token);
  assert.ok(config.hasToken);
  assert.ok(!JSON.stringify(config).includes("fake-test-token-long"));
});
test("login exige segundo fator após cadastro e rejeita código repetido", async (t) => {
  const h = await fixture(t);
  const enrollment = await h.service.security.begin(h.token, "Operations-test#2026");
  const recovery = await h.service.security.confirm(h.token, totp(enrollment.secret), true);
  h.service.logout(h.token);
  assert.equal((await h.service.session()).mfaRequired, true);
  await assert.rejects(h.service.login("Operations-test#2026", false, "mfa-login"), /Informe o código/);
  const nextCode = totp(enrollment.secret, Date.now() + 30000);
  const token = await h.service.login("Operations-test#2026", false, "mfa-login", nextCode);
  assert.equal((await h.service.session(token)).authenticated, true);
  await assert.rejects(h.service.login("Operations-test#2026", false, "mfa-login", nextCode), /já utilizado/);
  const restored = await h.service.login("Operations-test#2026", false, "mfa-login", recovery.recoveryCodes[0]!);
  assert.equal((await h.service.session(restored)).authenticated, true);
  await assert.rejects(h.service.login("Operations-test#2026", false, "mfa-login", recovery.recoveryCodes[0]!), /já utilizado/);
});
test("cupom expirado, uso único concorrente, desconto fixo e frete", async (t) => {
  const h = await fixture(t);
  const expired = couponSchema.parse({
    code: "EXPIRADO",
    percent: 10,
    min_total: 0,
    is_active: true,
    expires_at: "2020-01-01T00:00:00.000Z",
  });
  await h.service.saveCoupon(h.token, expired);
  await assert.rejects(
    h.service.place({ ...h.input(), coupon: expired.code }, "owner"),
    /expirado/,
  );
  await h.service.saveCoupon(h.token, {
    ...expired,
    code: "UNICO",
    expires_at: null,
    max_uses: 1,
    kind: "fixed",
    amount: 5,
  });
  const results = await Promise.allSettled([
    h.service.place({ ...h.input(), coupon: "UNICO" }, "owner"),
    h.service.place({ ...h.input(), coupon: "UNICO" }, "owner"),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  const order = (await h.service.snapshot(h.token)).orders[0]!;
  assert.equal(order.discount, 5);
  assert.equal(
    couponDiscount({ kind: "shipping", percent: 0 }, [{ product_id: "p", line_total: 20 }], 4),
    400,
  );
});
test("cotação WhatsApp não cria pedido; confirmação revalida preço e preserva origem", async (t) => {
  const h = await fixture(t),
    input = h.input();
  const quote = await h.service.place(input, "wa-owner", { quote: true, source: "whatsapp" });
  assert.equal((await h.service.snapshot(h.token)).orders.length, 0);
  await assert.rejects(
    h.service.place({ ...input, expected_total: quote.total + 1 }, "wa-owner", {
      source: "whatsapp",
    }),
    /preços/,
  );
  const placed = await h.service.place({ ...input, expected_total: quote.total }, "wa-owner", {
    source: "whatsapp",
  });
  const again = await h.service.place({ ...input, expected_total: quote.total }, "wa-owner", {
    source: "whatsapp",
  });
  assert.equal(placed.id, again.id);
  const order = (await h.service.snapshot(h.token)).orders[0]!;
  assert.equal(order.source, "whatsapp");
  assert.equal(order.payment_status, "pendente");
});
test("lojas possuem sessões e diretórios isolados", async (t) => {
  const h = await fixture(t);
  await h.service.place(h.input(), "owner");
  const other = createLaborService(h.directory, seed, "outra-loja");
  await assert.rejects(other.support.open("owner"), /outro estabelecimento/);
  await assert.rejects(other.snapshot(h.token), /não autorizado/);
});
test("fidelidade trata expiração e estorno após resgate sem disponibilizar saldo negativo", () => {
  const earned: LedgerEntry = {
    id: "a",
    phone: "1",
    orderId: "o",
    at: new Date().toISOString(),
    expiresAt: "2099-01-01T00:00:00.000Z",
    points: 100,
    cashback: 1000,
    kind: "earned",
    reference: "o",
  };
  const redeemed: LedgerEntry = {
    ...earned,
    id: "r",
    points: -60,
    cashback: -600,
    kind: "redeemed",
    reference: "request",
    allocations: [{ id: "a", points: 60, cashback: 600 }],
  };
  assert.equal(loyaltyBalance([earned, redeemed]).points, 40);
  const expired = { ...earned, expiresAt: "2020-01-01T00:00:00.000Z" };
  const next = { ...earned, id: "b", points: 50, cashback: 500 };
  assert.equal(loyaltyBalance([expired, redeemed, next]).points, 50);
  const reversal = {
    ...earned,
    id: "rev",
    points: -100,
    cashback: -1000,
    kind: "reversed" as const,
    reference: "a",
  };
  assert.equal(loyaltyBalance([earned, redeemed, reversal, next]).points, 0);
});
test("recuperação exige confirmação no mesmo WhatsApp; compra cancela carrinho", async (t) => {
  const h = await fixture(t),
    product = h.input().items[0]!;
  const tracked = await h.service.operations.trackCart("owner", {
    phone: "11999990000",
    products: [{ id: product.product_id, quantity: 1 }],
    consent: true,
  });
  const snapshot = await h.service.snapshot(h.token);
  const db = JSON.parse(await readFile(join(h.directory, "data.json"), "utf8"));
  assert.equal(verifyRecoveryCart(db, "5511888888888", `VINCULAR ${tracked.code}`), false);
  assert.equal(verifyRecoveryCart(db, "5511999990000", `VINCULAR ${tracked.code}`), true);
  assert.ok(marketingAllowed(db, "5511999990000"));
  assert.equal(operationsState(db).carts![0]!.verified, true);
  await h.service.place(h.input(), "owner");
  const saved = JSON.parse(await readFile(join(h.directory, "data.json"), "utf8"));
  assert.ok(saved.operations.carts[0].converted);
  assert.equal(snapshot.operations, undefined);
});
