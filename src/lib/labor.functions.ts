import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { laborOrderSchema, productSchema, categorySchema, storeSchema } from "./labor.schema";
import { DEMO_MODE } from "./demo";
import { supportConfigSchema } from "./support.types";
import { couponSchema } from "./coupons";
import { stockSchema } from "./inventory";
import { driverSchema, assignmentSchema } from "./delivery";

// Cookies and the file adapter are imported only within server handlers.
async function context() {
  const { getCookie, setCookie, getRequest } = await import("@tanstack/react-start/server");
  const { laborService } = await import("./labor.service");
  const { assertLaborRequest } = await import("./labor.runtime");
  const { startWhatsAppWorker } = await import("./whatsapp.worker");
  startWhatsAppWorker();
  if (!DEMO_MODE) throw new Error("Demonstração local desativada.");
  const request = getRequest();
  assertLaborRequest(request);
  const options = {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: new URL(request.url).protocol === "https:",
    path: "/",
    maxAge: 8 * 3600,
  };
  return {
    service: laborService,
    admin: getCookie("labor_admin"),
    owner: getCookie("labor_customer"),
    setCookie,
    options,
  };
}
export const laborCatalog = createServerFn({ method: "GET" }).handler(async () => {
  const c = await context();
  return c.service.catalog();
});
export const laborSession = createServerFn({ method: "GET" }).handler(async () => {
  const c = await context();
  return c.service.session(c.admin);
});
export const laborLogin = createServerFn({ method: "POST" })
  .validator((v: unknown) =>
    z
      .object({
        password: z.string().min(12).max(128),
        setup: z.boolean(),
        code: z.string().max(32).optional(),
      })
      .parse(v),
  )
  .handler(async ({ data }) => {
    const c = await context();
    const token = await c.service.login(data.password, data.setup, "local", data.code);
    c.setCookie("labor_admin", token, c.options);
    return { ok: true };
  });
export const laborLogout = createServerFn({ method: "POST" }).handler(async () => {
  const c = await context();
  c.service.logout(c.admin);
  c.setCookie("labor_admin", "", { ...c.options, maxAge: 0 });
  return { ok: true };
});
export const laborSnapshot = createServerFn({ method: "GET" }).handler(async () => {
  const c = await context();
  return c.service.snapshot(c.admin);
});
export const laborSaveStock = createServerFn({ method: "POST" })
  .validator((v: unknown) => stockSchema.parse(v))
  .handler(async ({ data }) => {
    const c = await context();
    return c.service.saveStock(c.admin, data);
  });
export const laborSaveDriver = createServerFn({ method: "POST" })
  .validator((v: unknown) => driverSchema.parse(v))
  .handler(async ({ data }) => {
    const c = await context();
    return c.service.saveDriver(c.admin, data);
  });
export const laborAssignDriver = createServerFn({ method: "POST" })
  .validator((v: unknown) => assignmentSchema.parse(v))
  .handler(async ({ data }) => {
    const c = await context();
    return c.service.assignDriver(c.admin, data);
  });
export const laborSaveProduct = createServerFn({ method: "POST" })
  .validator((v: unknown) => productSchema.parse(v))
  .handler(async ({ data }) => {
    const c = await context();
    return c.service.saveProduct(c.admin, data);
  });
export const laborSaveCategory = createServerFn({ method: "POST" })
  .validator((v: unknown) => categorySchema.parse(v))
  .handler(async ({ data }) => {
    const c = await context();
    return c.service.saveCategory(c.admin, data);
  });
export const laborSaveCoupon = createServerFn({ method: "POST" })
  .validator((v: unknown) => couponSchema.parse(v))
  .handler(async ({ data }) => {
    const c = await context();
    return c.service.saveCoupon(c.admin, data);
  });
export const laborSaveStore = createServerFn({ method: "POST" })
  .validator((v: unknown) => storeSchema.parse(v))
  .handler(async ({ data }) => {
    const c = await context();
    return c.service.saveStore(c.admin, data);
  });
export const laborStatus = createServerFn({ method: "POST" })
  .validator((v: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.string(),
        reason: z.string().max(300).optional(),
        expected: z.string().optional(),
      })
      .parse(v),
  )
  .handler(async ({ data }) => {
    const c = await context();
    return c.service.status(c.admin, data.id, data.status, data.reason, data.expected);
  });
export const laborAddNote = createServerFn({ method: "POST" })
  .validator((v: unknown) =>
    z.object({ id: z.string().uuid(), text: z.string().trim().min(1).max(1000) }).parse(v),
  )
  .handler(async ({ data }) => {
    const c = await context();
    return c.service.addNote(c.admin, data.id, data.text);
  });
export const laborVisitor = createServerFn({ method: "POST" }).handler(async () => {
  const c = await context();
  if (!c.owner) {
    const { randomBytes } = await import("node:crypto");
    c.setCookie("labor_customer", randomBytes(32).toString("hex"), {
      ...c.options,
      maxAge: 30 * 86400,
    });
  }
  return { ready: true };
});
export const laborTrackCart = createServerFn({ method: "POST" })
  .validator((v: unknown) =>
    z
      .object({
        phone: z.string().max(30),
        products: z.array(z.object({ id: z.string().uuid(), quantity: z.number() })).max(40),
        consent: z.literal(true),
      })
      .parse(v),
  )
  .handler(async ({ data }) => {
    const c = await context();
    return c.service.operations.trackCart(c.owner, data);
  });
export const laborPlaceOrder = createServerFn({ method: "POST" })
  .validator((v: unknown) => laborOrderSchema.parse(v))
  .handler(async ({ data }) => {
    const c = await context();
    if (!c.owner)
      throw new Error("Atualize o checkout para identificar esta sessão antes de confirmar.");
    return c.service.place(data, c.owner);
  });
export const laborGetOrder = createServerFn({ method: "POST" })
  .validator((v: unknown) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data }) => {
    const c = await context();
    return c.service.order(data.id, c.owner, c.admin);
  });
export const laborDeclarePix = createServerFn({ method: "POST" })
  .validator((v: unknown) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data }) => {
    const c = await context();
    return c.service.declarePix(data.id, c.owner);
  });
export const laborPayment = createServerFn({ method: "POST" })
  .validator((v: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["pago", "recusado", "pendente"]),
        expected: z.string().optional(),
      })
      .parse(v),
  )
  .handler(async ({ data }) => {
    const c = await context();
    return c.service.payment(c.admin, data.id, data.status, data.expected);
  });

const supportId = z.object({ id: z.string().uuid() });
export const supportOpen = createServerFn({ method: "POST" }).handler(async () => {
  const c = await context();
  let owner = c.owner;
  if (!owner) {
    const { randomBytes } = await import("node:crypto");
    owner = randomBytes(32).toString("hex");
    c.setCookie("labor_customer", owner, { ...c.options, maxAge: 30 * 86400 });
  }
  return c.service.support.open(owner);
});
export const supportGet = createServerFn({ method: "POST" })
  .validator((v: unknown) => supportId.parse(v))
  .handler(async ({ data }) => {
    const c = await context();
    return c.service.support.get(c.owner, data.id);
  });
export const supportSend = createServerFn({ method: "POST" })
  .validator((v: unknown) =>
    supportId
      .extend({ messageId: z.string().uuid(), text: z.string().trim().min(1).max(1000) })
      .parse(v),
  )
  .handler(async ({ data }) => {
    const c = await context();
    return c.service.support.send(c.owner, data.id, data.messageId, data.text);
  });
export const supportHandoff = createServerFn({ method: "POST" })
  .validator((v: unknown) => supportId.parse(v))
  .handler(async ({ data }) => {
    const c = await context();
    return c.service.support.handoff(c.owner, data.id);
  });
export const supportCart = createServerFn({ method: "POST" })
  .validator((v: unknown) =>
    supportId.extend({ messageId: z.string().uuid(), productId: z.string().uuid() }).parse(v),
  )
  .handler(async ({ data }) => {
    const c = await context();
    return c.service.support.cart(c.owner, data.id, data.messageId, data.productId);
  });
export const supportInbox = createServerFn({ method: "GET" }).handler(async () => {
  const c = await context();
  return c.service.support.inbox(c.admin);
});
export const supportControl = createServerFn({ method: "POST" })
  .validator((v: unknown) =>
    supportId.extend({ action: z.enum(["claim", "resume", "close"]) }).parse(v),
  )
  .handler(async ({ data }) => {
    const c = await context();
    return c.service.support.control(c.admin, data.id, data.action);
  });
export const supportReply = createServerFn({ method: "POST" })
  .validator((v: unknown) =>
    supportId
      .extend({ messageId: z.string().uuid(), text: z.string().trim().min(1).max(1000) })
      .parse(v),
  )
  .handler(async ({ data }) => {
    const c = await context();
    const conversation = (await c.service.support.inbox(c.admin)).find(
      (item) => item.id === data.id,
    );
    if (conversation?.channel === "whatsapp")
      return c.service.whatsapp.reply(c.admin, data.id, data.messageId, data.text);
    return c.service.support.reply(c.admin, data.id, data.messageId, data.text);
  });
export const supportConfig = createServerFn({ method: "GET" }).handler(async () => {
  const c = await context();
  return c.service.support.config(c.admin);
});
export const supportSaveConfig = createServerFn({ method: "POST" })
  .validator((v: unknown) => supportConfigSchema.parse(v))
  .handler(async ({ data }) => {
    const c = await context();
    return c.service.support.saveConfig(c.admin, data);
  });
export const supportReplaceKey = createServerFn({ method: "POST" })
  .validator((v: unknown) => z.object({ key: z.string().trim().min(20).max(250) }).parse(v))
  .handler(async ({ data }) => {
    const c = await context();
    return c.service.support.replaceKey(c.admin, data.key);
  });
export const supportModels = createServerFn({ method: "POST" }).handler(async () => {
  const c = await context();
  return c.service.support.models(c.admin);
});
export const supportTest = createServerFn({ method: "POST" })
  .validator((v: unknown) =>
    z.object({ model: z.string().regex(/^models\/[a-zA-Z0-9._-]+$/) }).parse(v),
  )
  .handler(async ({ data }) => {
    const c = await context();
    return c.service.support.test(c.admin, data.model);
  });
