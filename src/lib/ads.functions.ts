import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
async function context() {
  const { getCookie, getRequest } = await import("@tanstack/react-start/server");
  const { assertLaborRequest } = await import("./labor.runtime");
  const { laborService } = await import("./labor.service");
  assertLaborRequest(getRequest());
  const token = getCookie("labor_admin");
  return { service: laborService.ads, token: await laborService.activeSession(token) ? token : undefined };
}
export const adsDispatch = createServerFn({ method: "POST" }).handler(async () => {
  const c = await context();
  return c.service.dispatchConversions(c.token);
});
export const adsPrepare = createServerFn({ method: "POST" })
  .validator((v: unknown) => v)
  .handler(async ({ data }) => {
    const c = await context();
    return c.service.prepareAd(c.token, data);
  });
export const adsSnapshot = createServerFn({ method: "GET" }).handler(async () => {
  const c = await context();
  return c.service.snapshot(c.token);
});
export const adsConnect = createServerFn({ method: "POST" }).handler(async () => {
  const c = await context();
  const result = await c.service.connect(c.token);
  const { setCookie } = await import("@tanstack/react-start/server");
  // The Strict admin cookie is not sent on a Facebook redirect. Scope this
  // short-lived Lax cookie to the callback instead of weakening admin cookies.
  setCookie("labor_ads_oauth", c.token!, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/api/meta-ads/callback",
    maxAge: 600,
  });
  return result;
});
export const adsTrackingConfig = createServerFn({ method: "GET" }).handler(async () => ({
  pixel: /^\d+$/.test(process.env["META_ADS_PIXEL_ID"] || "")
    ? process.env["META_ADS_PIXEL_ID"]
    : "",
}));
export const adsSave = createServerFn({ method: "POST" })
  .validator((v: unknown) => v)
  .handler(async ({ data }) => {
    const c = await context();
    return c.service.save(c.token, data);
  });
export const adsAccount = createServerFn({ method: "POST" })
  .validator((v: unknown) =>
    z
      .string()
      .regex(/^act_\d+$/)
      .parse(v),
  )
  .handler(async ({ data }) => {
    const c = await context();
    return c.service.selectAccount(c.token, data);
  });
export const adsSync = createServerFn({ method: "POST" })
  .validator((v: unknown) => z.object({ since: z.string(), until: z.string() }).parse(v))
  .handler(async ({ data }) => {
    const c = await context();
    return c.service.sync(c.token, data.since, data.until);
  });
export const adsPublish = createServerFn({ method: "POST" })
  .validator((v: unknown) => z.object({ id: z.string().uuid(), confirm: z.boolean() }).parse(v))
  .handler(async ({ data }) => {
    const c = await context();
    return c.service.publish(c.token, data.id, data.confirm);
  });
export const adsChange = createServerFn({ method: "POST" })
  .validator((v: unknown) => v)
  .handler(async ({ data }) => {
    const c = await context();
    return c.service.change(c.token, data);
  });
export const adsSuggest = createServerFn({ method: "POST" })
  .validator((v: unknown) =>
    z.object({ productId: z.string().uuid(), extra: z.boolean() }).parse(v),
  )
  .handler(async ({ data }) => {
    const c = await context();
    return c.service.suggest(c.token, data.productId, data.extra);
  });
export const adsTrack = createServerFn({ method: "POST" })
  .validator((v: unknown) => v)
  .handler(async ({ data }) => {
    const c = await context();
    return c.service.track(data);
  });
