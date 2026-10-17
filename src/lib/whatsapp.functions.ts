import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { whatsappConfigSchema } from "./whatsapp.types";
import { laborOrderSchema } from "./labor.schema";
async function context() {
  const { getCookie, getRequest } = await import("@tanstack/react-start/server");
  const { laborService } = await import("./labor.service");
  const { DEMO_MODE } = await import("./demo");
  const { assertLaborRequest } = await import("./labor.runtime");
  if (!DEMO_MODE) throw new Error("Painel indisponível.");
  assertLaborRequest(getRequest());
  return { service: laborService, token: getCookie("labor_admin") };
}
export const waConfig = createServerFn({ method: "GET" }).handler(async () => {
  const c = await context();
  return c.service.whatsapp.config(c.token);
});
export const waDownloadMedia = createServerFn({ method: "POST" })
  .validator((v: unknown) =>
    z.object({ id: z.string().uuid(), messageId: z.string().max(200) }).parse(v),
  )
  .handler(async ({ data }) => {
    const c = await context();
    return c.service.whatsapp.downloadMedia(c.token, data.id, data.messageId);
  });
export const waSendMedia = createServerFn({ method: "POST" })
  .validator((v: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        messageId: z.string().uuid(),
        mime: z.enum(["image/jpeg", "image/png", "audio/ogg", "audio/mpeg", "application/pdf"]),
        name: z.string().max(80),
        data: z.string().max(11200000),
      })
      .parse(v),
  )
  .handler(async ({ data }) => {
    const c = await context();
    return c.service.whatsapp.sendMedia(c.token, data.id, data.messageId, data);
  });
export const waPropose = createServerFn({ method: "POST" })
  .validator((v: unknown) => z.object({ id: z.string().uuid(), order: laborOrderSchema }).parse(v))
  .handler(async ({ data }) => {
    const c = await context();
    return c.service.whatsapp.propose(c.token, data.id, data.order);
  });
export const waSave = createServerFn({ method: "POST" })
  .validator((v: unknown) => whatsappConfigSchema.parse(v))
  .handler(async ({ data }) => {
    const c = await context();
    return c.service.whatsapp.saveConfig(c.token, data);
  });
export const waSecrets = createServerFn({ method: "POST" })
  .validator((v: unknown) =>
    z
      .object({
        token: z.string().max(4096).optional(),
        appSecret: z.string().max(200).optional(),
        verifyToken: z.string().max(200).optional(),
      })
      .parse(v),
  )
  .handler(async ({ data }) => {
    const c = await context();
    return c.service.whatsapp.replaceSecrets(c.token, data);
  });
export const waTest = createServerFn({ method: "POST" }).handler(async () => {
  const c = await context();
  return c.service.whatsapp.test(c.token);
});
export const waTemplates = createServerFn({ method: "POST" }).handler(async () => {
  const c = await context();
  return c.service.whatsapp.syncTemplates(c.token);
});
export const waTemplateReply = createServerFn({ method: "POST" })
  .validator((v: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        messageId: z.string().uuid(),
        text: z.string().min(1).max(1000),
        template: z.object({
          name: z.string().max(512),
          language: z.string().max(30),
          parameters: z.array(z.string().max(500)).max(8),
        }),
      })
      .parse(v),
  )
  .handler(async ({ data }) => {
    const c = await context();
    return c.service.whatsapp.reply(c.token, data.id, data.messageId, data.text, data.template);
  });
export const securityStatus = createServerFn({ method: "GET" }).handler(async () => {
  const c = await context();
  return c.service.security.status(c.token);
});
export const securityBegin = createServerFn({ method: "POST" })
  .validator((v: unknown) => z.object({ password: z.string().min(12).max(128) }).parse(v))
  .handler(async ({ data }) => {
    const c = await context();
    return c.service.security.begin(c.token, data.password);
  });
export const securityConfirm = createServerFn({ method: "POST" })
  .validator((v: unknown) =>
    z.object({ code: z.string().min(6).max(30), enrollment: z.boolean() }).parse(v),
  )
  .handler(async ({ data }) => {
    const c = await context();
    return c.service.security.confirm(c.token, data.code, data.enrollment);
  });
