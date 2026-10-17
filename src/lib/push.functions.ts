import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
async function context() {
  const { getCookie, getRequest } = await import("@tanstack/react-start/server");
  const { laborService } = await import("./labor.service");
  const { DEMO_MODE } = await import("./demo");
  const { assertLaborRequest } = await import("./labor.runtime");
  if (!DEMO_MODE) throw new Error("Painel indisponível.");
  assertLaborRequest(getRequest());
  const token = getCookie("labor_admin");
  if (!(await laborService.session(token)).authenticated) throw new Error("Faça login no painel.");
  return laborService.push;
}
export const pushInfo = createServerFn({ method: "GET" }).handler(async () => {
  const push = await context();
  return { publicKey: await push.publicKey(), ...await push.status() };
});
export const pushSubscribe = createServerFn({ method: "POST" })
  .validator((v: unknown) => z.object({ endpoint: z.string().url().max(2048), expirationTime: z.number().nullable().optional(), keys: z.object({ p256dh: z.string(), auth: z.string() }) }).parse(v))
  .handler(async ({ data }) => (await context()).subscribe(data));
export const pushUnsubscribe = createServerFn({ method: "POST" })
  .validator((v: unknown) => z.object({ endpoint: z.string().url() }).parse(v))
  .handler(async ({ data }) => (await context()).unsubscribe(data.endpoint));
