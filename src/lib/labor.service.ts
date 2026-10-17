// Server-only local demo adapter. It deliberately has no Supabase credentials.
import { readFile, writeFile, rename, mkdir, rm } from "node:fs/promises";
import { resolve, join } from "node:path";
import { randomBytes, randomUUID, scryptSync, timingSafeEqual, createHash } from "node:crypto";
import seed from "../data/labor-catalog.json";
import type { LaborDatabase, LaborOrder } from "./labor.types";
import { createSupportService } from "./support.service";
import { createSecurityService } from "./security.service";
import { createWhatsAppService } from "./whatsapp.service";
import { createOperationsService, normalizePhone } from "./operations.service";
import { createPushService } from "./push.service";
import { createSupportVault } from "./support.secrets";
import { stockSchema, stockFor, productUnavailable, ensureStock, reserveStock, restoreStock } from "./inventory";
import { driverSchema, assignmentSchema } from "./delivery";
import { couponSchema, couponDiscount } from "./coupons";
import {
  migrateV2,
  saleFor,
  validQuantity,
  lineCents,
  validateFulfillment,
  nextStatuses,
} from "./vendrex.rules";
import {
  categorySchema,
  productSchema,
  storeSchema,
  laborOrderSchema,
  STATUSES,
} from "./labor.schema";

const clone = <T>(v: T): T => structuredClone(v);
export function createLaborService(
  directory = resolve(process.env["DEMO_DATA_DIR"] || ".local/labor"),
  initialCatalog: LaborDatabase = seed as unknown as LaborDatabase,
  storeId = process.env["LABOR_STORE_ID"] || "acai-labor",
) {
  let queue: Promise<unknown> = Promise.resolve();
  const sessions = new Map<string, number>();
  const attempts = new Map<string, { count: number; until: number }>();
  const encryptedData = process.env["LABOR_ENCRYPT_DATA"] === "1" ? createSupportVault(directory, "database") : null;
  let encryptedCache: LaborDatabase | undefined;
  let encryptedLoad: Promise<LaborDatabase> | undefined;
  async function read(): Promise<LaborDatabase> {
    if (encryptedData && encryptedCache) return clone(encryptedCache);
    if (encryptedData) {
      encryptedLoad ??= load().then((db) => {
        encryptedCache = clone(db);
        return db;
      }).catch((error) => {
        encryptedLoad = undefined;
        throw error;
      });
      return clone(await encryptedLoad);
    }
    return load();
  }
  async function load(): Promise<LaborDatabase> {
    try {
      const encrypted = encryptedData && await encryptedData.get();
      const db = migrateV2(JSON.parse(encrypted || await readFile(join(directory, "data.json"), "utf8")));
      if ((db.store_id || "acai-labor") !== storeId)
        throw new Error("Pasta pertence a outro estabelecimento.");
      db.store_id = storeId;
      if (encryptedData && !encrypted) {
        await encryptedData.replace(JSON.stringify(db));
        await rm(join(directory, "data.json"), { force: true });
      }
      return db;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return {...migrateV2(clone(initialCatalog)),store_id:storeId};
      throw e;
    }
  }
  function mutate<T>(fn: (db: LaborDatabase) => T | Promise<T>): Promise<T> {
    const operation = queue.then(async () => {
      await mkdir(directory, { recursive: true });
      const db = await read();
      const result = await fn(db);
      if (encryptedData) {
        await encryptedData.replace(JSON.stringify(db));
        encryptedCache = clone(db);
        await rm(join(directory, "data.json"), { force: true });
      } else {
        const tmp = join(directory, `data-${randomUUID()}.tmp`);
        await writeFile(tmp, JSON.stringify(db, null, 2), { mode: 0o600 });
        await rename(tmp, join(directory, "data.json"));
      }
      return result;
    });
    queue = operation.catch(() => {});
    return operation;
  }
  const hash = (token: string) => createHash("sha256").update(token).digest("hex");
  const audit = (
    db: LaborDatabase,
    action: string,
    resource_id: string,
    detail: string,
    actor = "proprietario-local",
  ) => {
    (db.audit ??= []).push({
      id: randomUUID(),
      at: new Date().toISOString(),
      actor,
      action,
      resource_id,
      detail,
    });
  };
  const authorized = (token: string | undefined) =>
    !!token && (sessions.get(hash(token)) || 0) > Date.now();
  function requireAdmin(token: string | undefined) {
    if (!authorized(token)) throw new Error("Acesso administrativo não autorizado. Faça login.");
  }
  async function passwordRecord() {
    try {
      return JSON.parse(await readFile(join(directory, "admin.json"), "utf8")) as {
        salt: string;
        hash: string;
      };
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw e;
    }
  }
  const base = { directory, storeId, read, mutate, requireAdmin, audit };
  const security = createSecurityService(base, async (password) => {
    const record = await passwordRecord();
    if (
      !record ||
      !timingSafeEqual(Buffer.from(record.hash, "hex"), scryptSync(password, record.salt, 64))
    )
      throw new Error("Senha incorreta.");
  });
  const support = createSupportService({ ...base, requireSensitive: security.requireSensitive });
  let orderPort: (
    raw: unknown,
    owner: string,
    quote: boolean,
  ) => Promise<{ id: string; order_number: number; total: number; summary: string }>;
  const whatsapp = createWhatsAppService(
    { ...base, requireSensitive: security.requireSensitive },
    support,
    { order: (raw, owner, quote) => orderPort(raw, owner, quote) },
  );
  const operations = createOperationsService({
    ...base,
    requireSensitive: security.requireSensitive,
  });
  const push = createPushService(directory);
  const service = {
    security,
    support,
    whatsapp,
    operations,
    push,
    async catalog() {
      const db = await read();
      return {
        store: db.store,
        categories: db.categories
          .filter((c) => c.is_active)
          .sort((a, b) => a.sort_order - b.sort_order),
        products: db.products.filter(
          (p) => p.is_active && db.categories.some((c) => c.id === p.category_id && c.is_active),
        ).map((p) => ({ ...p, is_sold_out: productUnavailable(db, p), stock: Object.fromEntries((db.inventory || []).filter((item) => item.productId === p.id).map((item) => [item.saleOptionId || "base", item.quantity])) })),
        coupons: db.coupons.map((c) => ({
          ...c,
          code: c.code,
          percent: c.percent,
          min_total: c.min_total,
          is_active: c.is_active,
        })),
      };
    },
    async session(token?: string) {
      return { authenticated: authorized(token), needsSetup: !(await passwordRecord()), mfaRequired: await security.loginRequired() };
    },
    async login(password: string, setup: boolean, client = "local", code?: string) {
      const failed = attempts.get(client);
      if (failed && failed.until > Date.now() && failed.count >= 5)
        throw new Error("Muitas tentativas. Aguarde 15 minutos.");
      if (password.length < 12 || password.length > 128)
        throw new Error("Use uma senha entre 12 e 128 caracteres.");
      // Serialize first setup, so concurrent requests cannot replace the password.
      await mutate(async () => {
        const failed = attempts.get(client);
        if (failed && failed.until > Date.now() && failed.count >= 5)
          throw new Error("Muitas tentativas. Aguarde 15 minutos.");
        let record = await passwordRecord();
        if (!record) {
          if (!setup) throw new Error("Defina sua senha no primeiro acesso.");
          const salt = randomBytes(16).toString("hex");
          record = { salt, hash: scryptSync(password, salt, 64).toString("hex") };
          await writeFile(join(directory, "admin.json"), JSON.stringify(record), {
            mode: 0o600,
            flag: "wx",
          });
        } else if (setup)
          throw new Error("O administrador já está configurado. Entre com sua senha.");
        if (
          !timingSafeEqual(Buffer.from(record.hash, "hex"), scryptSync(password, record.salt, 64))
        ) {
          const n = failed && failed.until > Date.now() ? failed.count : 0;
          attempts.set(client, { count: n + 1, until: Date.now() + 900000 });
          throw new Error("Senha incorreta.");
        }
      });
      await security.verifyLoginCode(code, client);
      attempts.delete(client);
      for (const [key, expires] of sessions) if (expires < Date.now()) sessions.delete(key);
      const token = randomBytes(32).toString("hex");
      sessions.set(hash(token), Date.now() + 8 * 3600000);
      return token;
    },
    logout(token?: string) {
      if (token) sessions.delete(hash(token));
    },
    async snapshot(token?: string) {
      requireAdmin(token);
      const {
        support: _support,
        security: _security,
        whatsapp: _whatsapp,
        operations: _operations,
        ...snapshot
      } = await read();
      return snapshot;
    },
    async saveProduct(token: string | undefined, input: unknown) {
      requireAdmin(token);
      const product = productSchema.parse(input);
      return mutate((db) => {
        if (product.category_id && !db.categories.some((c) => c.id === product.category_id))
          throw new Error("Categoria inexistente");
        const index = db.products.findIndex((p) => p.id === product.id);
        if (
          db.products.some(
            (p) =>
              p.id !== product.id &&
              (p.slug === product.slug || (product.sku && p.sku === product.sku)),
          )
        )
          throw new Error("SKU ou endereço do produto já cadastrado.");
        if (index >= 0) db.products[index] = product;
        else db.products.push(product);
        audit(
          db,
          "produto.salvo",
          product.id,
          `${product.name}; preço base ${product.price.toFixed(2)}; ${product.sale_options.length} embalagens`,
        );
        return product;
      });
    },
    async saveStock(token: string | undefined, input: unknown) {
      requireAdmin(token);
      const value = stockSchema.parse(input);
      return mutate((db) => {
        const product = db.products.find((item) => item.id === value.productId);
        if (!product || (value.saleOptionId && !(product.sale_options || []).some((item) => item.id === value.saleOptionId)))
          throw new Error("Produto ou embalagem inexistente.");
        const at = new Date().toISOString();
        let record = stockFor(db, value.productId, value.saleOptionId);
        const delta = value.quantity - (record?.quantity || 0);
        if (record) Object.assign(record, { quantity: value.quantity, lowAt: value.lowAt, updatedAt: at });
        else (db.inventory ??= []).push((record = { ...value, updatedAt: at }));
        (db.stockMovements ??= []).push({ id: randomUUID(), at, productId: value.productId, saleOptionId: value.saleOptionId, delta, reason: "ajuste" });
        audit(db, "estoque.ajustado", value.productId, `${value.saleOptionId || "base"}: ${value.quantity}`);
        return record;
      });
    },
    async saveDriver(token: string | undefined, input: unknown) {
      requireAdmin(token);
      const driver = driverSchema.parse(input);
      return mutate((db) => {
        const index = (db.drivers || []).findIndex((item) => item.id === driver.id);
        if (index < 0) (db.drivers ??= []).push(driver);
        else db.drivers![index] = driver;
        audit(db, "entregador.salvo", driver.id, `${driver.name}; ${driver.active ? "ativo" : "inativo"}`);
        return driver;
      });
    },
    async assignDriver(token: string | undefined, input: unknown) {
      requireAdmin(token);
      const value = assignmentSchema.parse(input);
      return mutate((db) => {
        const order = db.orders.find((item) => item.id === value.orderId);
        const driver = db.drivers?.find((item) => item.id === value.driverId && item.active);
        if (!order || order.fulfillment !== "delivery" || !["pronto", "saiu_entrega"].includes(order.status))
          throw new Error("Escolha um pedido de entrega pronto ou em rota.");
        if (!driver) throw new Error("Entregador ativo não encontrado.");
        let assignment = db.driverAssignments?.find((item) => item.orderId === order.id);
        if (assignment?.deliveredAt) throw new Error("Entrega já concluída.");
        if (assignment) Object.assign(assignment, { driverId: driver.id, assignedAt: new Date().toISOString(), feePerDelivery: driver.feePerDelivery, dailyFee: driver.dailyFee });
        else (db.driverAssignments ??= []).push((assignment = { orderId: order.id, driverId: driver.id, assignedAt: new Date().toISOString(), feePerDelivery: driver.feePerDelivery, dailyFee: driver.dailyFee }));
        audit(db, "entrega.atribuida", order.id, driver.name);
        return assignment;
      });
    },
    async saveCategory(token: string | undefined, input: unknown) {
      requireAdmin(token);
      const category = categorySchema.parse(input);
      return mutate((db) => {
        if (db.categories.some((c) => c.id !== category.id && c.slug === category.slug))
          throw new Error("Endereço da categoria já cadastrado.");
        const index = db.categories.findIndex((c) => c.id === category.id);
        if (index >= 0) db.categories[index] = category;
        else db.categories.push(category);
        audit(db, "categoria.salva", category.id, category.name);
        return category;
      });
    },
    async saveCoupon(token: string | undefined, input: unknown) {
      requireAdmin(token);
      const coupon = couponSchema.parse(input);
      return mutate((db) => {
        if (coupon.product_ids.some((id) => !db.products.some((p) => p.id === id)))
          throw new Error("Produto do cupom não encontrado.");
        const index = db.coupons.findIndex((c) => c.code === coupon.code);
        if (index >= 0) db.coupons[index] = coupon;
        else db.coupons.push(coupon);
        audit(db, "cupom.salvo", coupon.code, "Regras do cupom atualizadas");
        return { ok: true };
      });
    },
    async saveStore(token: string | undefined, input: unknown) {
      requireAdmin(token);
      const store = storeSchema.parse(input);
      return mutate((db) => {
        db.store = store;
        audit(db, "loja.salva", "local", "Identidade e regras de atendimento atualizadas");
        return store;
      });
    },
    async status(
      token: string | undefined,
      id: string,
      status: string,
      reason = "",
      expected?: string,
    ) {
      requireAdmin(token);
      if (!(STATUSES as readonly string[]).includes(status)) throw new Error("Status inválido");
      return mutate((db) => {
        const o = db.orders.find((o) => o.id === id);
        if (!o) throw new Error("Pedido não encontrado");
        if (o.status === status) return o;
        if (expected && o.status !== expected)
          throw new Error("O pedido foi atualizado por outro atendimento. Atualize o painel.");
        if (["cancelado", "concluido"].includes(o.status)) throw new Error("Pedido já encerrado");
        if (o.fulfillment === "pickup" && status === "saiu_entrega")
          throw new Error("Pedido para retirada não sai para entrega");
        if (!nextStatuses(o).includes(status))
          throw new Error("Transição de status inválida. Siga as etapas do pedido.");
        if (status === "cancelado" && reason.trim().length < 3)
          throw new Error("Informe o motivo do cancelamento.");
        if (reason.length > 300) throw new Error("Motivo muito longo.");
        o.status = status;
        o.history.push({
          status,
          at: new Date().toISOString(),
          actor: "proprietario-local",
          ...(status === "cancelado" ? { reason: reason.trim() } : {}),
        });
        if (status === "cancelado") restoreStock(db, o);
        if (status === "entregue") {
          const assignment = db.driverAssignments?.find((item) => item.orderId === id);
          if (assignment) assignment.deliveredAt = new Date().toISOString();
        }
        audit(db, "pedido.status", id, status);
        return o;
      });
    },
    async addNote(token: string | undefined, id: string, text: string) {
      requireAdmin(token);
      if (!text.trim() || text.length > 1000)
        throw new Error("Nota deve conter entre 1 e 1000 caracteres.");
      return mutate((db) => {
        const order = db.orders.find((o) => o.id === id);
        if (!order) throw new Error("Pedido não encontrado");
        (order.internal_notes ??= []).push({
          text: text.trim(),
          at: new Date().toISOString(),
          actor: "proprietario-local",
        });
        audit(db, "pedido.nota", id, "Nota interna adicionada");
        return { ok: true };
      });
    },
    async place(
      raw: unknown,
      owner: string,
      options: { quote?: boolean; source?: "site" | "whatsapp" } = {},
    ) {
      if (!owner) throw new Error("Identificação do visitante necessária.");
      const input = laborOrderSchema.parse(raw);
      const fingerprint = hash(JSON.stringify(input));
      let createdOrder: LaborOrder | undefined;
      const placed = await mutate((db) => {
        const prior = (
          db.orders as Array<
            LaborOrder & { request_id?: string; owner?: string; fingerprint?: string }
          >
        ).find((o) => o.request_id === input.request_id && o.owner === hash(owner));
        if (prior) {
          if (prior.fingerprint && prior.fingerprint !== fingerprint)
            throw new Error("Este identificador já foi usado em outro conteúdo de pedido.");
          return {
            id: prior.id,
            order_number: prior.order_number,
            total: prior.total,
            summary: `Pedido #${prior.order_number} já registrado. Total R$ ${prior.total.toFixed(2)}.`,
          };
        }
        validateFulfillment(db.store, input.fulfillment, input.scheduled_for);
        const cents = (n: number) => Math.round(n * 100);
        const items = input.items.map((i) => {
          const p = db.products.find((p) => p.id === i.product_id);
          if (!p || !p.is_active || p.is_sold_out)
            throw new Error("Produto indisponível. Atualize o carrinho.");
          if (!db.categories.some((c) => c.id === p.category_id && c.is_active))
            throw new Error("Categoria indisponível");
          const sale = saleFor(p, i.sale_option_id);
          if (!validQuantity(i.quantity, sale.min_quantity, sale.quantity_step))
            throw new Error(
              `Quantidade inválida para ${p.name}: mínimo ${sale.min_quantity}, múltiplos de ${sale.quantity_step} a partir do mínimo.`,
            );
          if (new Set(i.addons.map((a) => a.addon_id)).size !== i.addons.length)
            throw new Error("Adicional duplicado");
          const all = p.addon_groups.flatMap((g) => g.product_addons);
          const extras = i.addons.map((a) => {
            const option = all.find((x) => x.id === a.addon_id && x.is_active);
            if (!option)
              throw new Error("Adicional não pertence a este produto ou está indisponível");
            return { id: option.id, name: option.name, price: option.price, quantity: a.quantity };
          });
          for (const group of p.addon_groups) {
            const count = i.addons
              .filter((a) => group.product_addons.some((x) => x.id === a.addon_id))
              .reduce((s, a) => s + a.quantity, 0);
            const min = group.is_required ? Math.max(1, group.min_select) : group.min_select;
            if (count < min || count > group.max_select)
              throw new Error(
                `Revise as opções de ${group.title}: mínimo ${min}, máximo ${group.max_select}.`,
              );
          }
          const now = Date.now();
          const promo = p.promotions.find(
            (r) =>
              r.is_active &&
              (!r.starts_at || Date.parse(r.starts_at) <= now) &&
              (!r.ends_at || Date.parse(r.ends_at) >= now),
          );
          const unit = i.sale_option_id
            ? cents(sale.price)
            : promo?.promo_price != null
              ? cents(promo.promo_price)
              : promo?.discount_percent != null
                ? Math.round(cents(p.price) * (1 - promo.discount_percent / 100))
                : cents(p.price);
          if (p.slug.startsWith("10-caixas") && !["pix", "dinheiro"].includes(input.payment_method))
            throw new Error(
              "O combo de 10 caixas é válido somente para Pix ou dinheiro, conforme o material.",
            );
          const line = lineCents(
            unit + extras.reduce((s, a) => s + cents(a.price) * a.quantity, 0),
            i.quantity,
          );
          return {
            id: randomUUID(),
            product_id: p.id,
            product_name: p.name,
            quantity: i.quantity,
            sale_option_id: i.sale_option_id || null,
            sale_label: sale.label,
            unit_price: unit / 100,
            line_total: line / 100,
            notes: i.notes || null,
            order_item_addons: extras,
          };
        });
        const stockNeeded = ensureStock(db, items);
        const subtotal = items.reduce((s, i) => s + cents(i.line_total), 0);
        const fee = input.fulfillment === "delivery" ? cents(db.store.delivery_fee) : 0;
        let discount = 0;
        let shippingDiscount = false;
        if (input.coupon?.trim()) {
          const coupon = db.coupons.find(
            (c) => c.code === input.coupon!.trim().toUpperCase() && c.is_active,
          );
          if (!coupon || subtotal < cents(coupon.min_total))
            throw new Error("Cupom inválido ou pedido abaixo do mínimo do cupom.");
          if (coupon.expires_at && Date.parse(coupon.expires_at) < Date.now())
            throw new Error("Cupom expirado.");
          const ownedOrders = (db.orders as Array<LaborOrder & { owner?: string }>).filter(
            (o) => o.owner === hash(owner) && o.status !== "cancelado",
          );
          const used = db.orders.filter(
            (o) => o.coupon_code === coupon.code && o.status !== "cancelado",
          );
          if (
            (coupon.max_uses && used.length >= coupon.max_uses) ||
            (coupon.per_customer &&
              ownedOrders.filter((o) => o.coupon_code === coupon.code).length >=
                coupon.per_customer)
          )
            throw new Error("Limite de utilizações do cupom atingido.");
          if (
            (coupon.eligibility === "first" && ownedOrders.length) ||
            (coupon.eligibility === "recurring" && ownedOrders.length < 2) ||
            (coupon.eligibility === "inactive" &&
              (!ownedOrders.length ||
                Date.parse(ownedOrders.at(-1)!.created_at) >
                  Date.now() - (coupon.inactive_days || 30) * 86400000))
          )
            throw new Error("Cupom não disponível para este histórico de compras.");
          discount = couponDiscount(coupon, items, fee / 100);
          shippingDiscount = coupon.kind === "shipping";
        }
        if (subtotal - (shippingDiscount ? 0 : discount) < cents(db.store.minimum_order ?? 0))
          throw new Error(
            `Pedido mínimo de R$ ${(db.store.minimum_order || 0).toFixed(2)} em produtos após descontos, sem a entrega.`,
          );
        const total = subtotal - discount + fee;
        if (input.expected_total != null && cents(input.expected_total) !== total)
          throw new Error("Os preços foram atualizados. Revise o resumo e confirme novamente.");
        if (
          input.payment_method === "dinheiro" &&
          input.change_for != null &&
          cents(input.change_for) < total
        )
          throw new Error("O valor para troco deve cobrir o total do pedido.");
        const at = new Date().toISOString();
        const order: LaborOrder & { request_id: string; owner: string; fingerprint: string } = {
          id: randomUUID(),
          order_number: 1001 + db.orders.length,
          created_at: at,
          status: "recebido",
          is_test: true,
          payment_status: "pendente",
          coupon_code: input.coupon?.trim().toUpperCase() || "",
          scheduled_for: input.scheduled_for || null,
          source: options.source || "site",
          internal_notes: [],
          customer_name: input.customer_name,
          customer_phone: input.customer_phone,
          street: input.street,
          number: input.number,
          complement: input.complement || null,
          neighborhood: input.neighborhood,
          reference: input.reference || null,
          payment_method: input.payment_method,
          change_for: input.change_for ?? null,
          notes: input.notes || null,
          fulfillment: input.fulfillment,
          subtotal: subtotal / 100,
          delivery_fee: fee / 100,
          discount: discount / 100,
          total: total / 100,
          order_items: items,
          history: [{ status: "recebido", at, actor: "cliente" }],
          request_id: input.request_id,
          fingerprint,
          owner: hash(owner),
        };
        const summary = `${items.map((i) => `${i.quantity} × ${i.product_name}${i.sale_label ? ` (${i.sale_label})` : ""}: R$ ${i.line_total.toFixed(2)}${i.order_item_addons.length ? `\nAdicionais: ${i.order_item_addons.map((a) => `${a.quantity} × ${a.name}`).join(", ")}` : ""}${i.notes ? `\nObs.: ${i.notes}` : ""}`).join("\n")}\nEntrega: R$ ${(fee / 100).toFixed(2)} · desconto: R$ ${(discount / 100).toFixed(2)}\nTotal: R$ ${order.total.toFixed(2)}\n${input.fulfillment === "delivery" ? `${input.street}, ${input.number} — ${input.neighborhood}` : "Retirada na loja"}\nPagamento: ${input.payment_method}. Pedido local de teste, sem cobrança online.`;
        if (options.quote) return { id: "", order_number: 0, total: order.total, summary };
        db.orders.push(order);
        reserveStock(db, order, stockNeeded);
        for (const [stock] of stockNeeded)
          if (stock.quantity <= stock.lowAt)
            audit(db, "estoque.baixo", stock.productId, `${stock.saleOptionId || "base"}: ${stock.quantity}`);
        createdOrder = order;
        for (const cart of db.operations?.carts || [])
          if (!cart.converted && (cart.ownerHash === hash(owner) || (options.source === "whatsapp" && cart.verified && cart.phone === normalizePhone(input.customer_phone)))) {
            cart.converted = true;
            const campaign = db.operations?.campaigns.find((c) => c.id === cart.id);
            if (campaign) campaign.state = "paused";
            for (const job of db.whatsapp?.outbound || [])
              if (job.campaignId === cart.id && job.state === "queued") job.state = "cancelled";
          }
        audit(
          db,
          "pedido.criado",
          order.id,
          `Pedido #${order.order_number}; pagamento pendente`,
          "cliente",
        );
        return { id: order.id, order_number: order.order_number, total: order.total, summary };
      });
      if (createdOrder) await push.newOrder(createdOrder).catch(() => ({ sent: 0, failed: 0 }));
      return placed;
    },
    async order(id: string, owner: string | undefined, admin?: string) {
      const db = await read();
      const order = (db.orders as Array<LaborOrder & { owner?: string }>).find((o) => o.id === id);
      if (!order || (!authorized(admin) && (!owner || order.owner !== hash(owner)))) return null;
      const { owner: _, internal_notes: _notes, ...dto } = order;
      delete (dto as Record<string, unknown>)["request_id"];
      delete (dto as Record<string, unknown>)["fingerprint"];
      return dto as LaborOrder;
    },
  };
  orderPort = (raw, owner, quote) => service.place(raw, owner, { quote, source: "whatsapp" });
  return service;
}
export const laborService = createLaborService();
