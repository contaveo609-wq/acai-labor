import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { operationsConfigSchema, campaignSchema } from "./operations.types";
async function context() {
  const { getCookie, getRequest } = await import("@tanstack/react-start/server");
  const { laborService } = await import("./labor.service");
  const { DEMO_MODE } = await import("./demo");
  const { assertLaborRequest } = await import("./labor.runtime");
  if (!DEMO_MODE) throw new Error("Painel indisponível.");
  assertLaborRequest(getRequest());
  const token = getCookie("labor_admin");
  return { service: laborService.operations, token: await laborService.activeSession(token) ? token : undefined };
}
export const operationsSnapshot = createServerFn({ method: "GET" }).handler(async () => {
  const c = await context();
  return c.service.snapshot(c.token);
});
export const recoverySave = createServerFn({ method: "POST" })
  .validator((v: unknown) =>
    z
      .object({
        enabled: z.boolean(),
        hours: z.number(),
        template: z.string(),
        language: z.string(),
      })
      .parse(v),
  )
  .handler(async ({ data }) => {
    const c = await context();
    return c.service.recoveryConfig(c.token, data);
  });
export const operationsSave = createServerFn({ method: "POST" })
  .validator((v: unknown) => operationsConfigSchema.parse(v))
  .handler(async ({ data }) => {
    const c = await context();
    return c.service.saveConfig(c.token, data);
  });
export const contactSave = createServerFn({ method: "POST" })
  .validator((v: unknown) =>
    z
      .object({
        phone: z.string(),
        tags: z.array(z.string()),
        notes: z.string(),
        consent: z.boolean().optional(),
        evidence: z.string().default(""),
      })
      .parse(v),
  )
  .handler(async ({ data }) => {
    const c = await context();
    return c.service.saveContact(c.token, data);
  });
export const campaignSave = createServerFn({ method: "POST" })
  .validator((v: unknown) => campaignSchema.parse(v))
  .handler(async ({ data }) => {
    const c = await context();
    return c.service.saveCampaign(c.token, data);
  });
export const campaignAction = createServerFn({ method: "POST" })
  .validator((v: unknown) =>
    z.object({ id: z.string().uuid(), action: z.enum(["confirm", "pause"]) }).parse(v),
  )
  .handler(async ({ data }) => {
    const c = await context();
    return c.service.campaignAction(c.token, data.id, data.action);
  });
export const loyaltyRedeem = createServerFn({ method: "POST" })
  .validator((v: unknown) =>
    z
      .object({
        phone: z.string().regex(/^\d{8,15}$/),
        points: z.number().int().min(0),
        cashback: z.number().min(0),
        reference: z.string().uuid(),
      })
      .parse(v),
  )
  .handler(async ({ data }) => {
    const c = await context();
    return c.service.redeem(c.token, data.phone, data.points, data.cashback, data.reference);
  });
export const notificationRead = createServerFn({ method: "POST" })
  .validator((v: unknown) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data }) => {
    const c = await context();
    return c.service.readNotification(c.token, data.id);
  });
