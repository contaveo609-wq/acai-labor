import { adsTrack, adsTrackingConfig } from "./ads.functions";
type Pixel = (command: string, ...args: unknown[]) => void;
declare global {
  interface Window {
    fbq?: Pixel;
    _fbq?: Pixel;
  }
}
export function campaignOrigin() {
  if (typeof window === "undefined" || localStorage.getItem("labor-marketing-consent") !== "yes")
    return undefined;
  try {
    return JSON.parse(sessionStorage.getItem("labor-campaign-origin") || "null") as
      { campaign?: string; source?: string; medium?: string } | undefined;
  } catch {
    return undefined;
  }
}
export async function trackAdEvent(
  name: "PageView" | "ViewContent" | "AddToCart" | "InitiateCheckout",
  productId?: string,
) {
  if (typeof window === "undefined" || localStorage.getItem("labor-marketing-consent") !== "yes")
    return;
  const id = crypto.randomUUID(),
    at = new Date().toISOString();
  try {
    const url = new URL(window.location.href),
      safe = (key: string) => {
        const v = url.searchParams.get(key);
        return v && /^[\w.-]{1,120}$/.test(v) ? v : undefined;
      };
    if (safe("utm_campaign"))
      sessionStorage.setItem(
        "labor-campaign-origin",
        JSON.stringify({
          campaign: safe("utm_campaign"),
          source: safe("utm_source"),
          medium: safe("utm_medium"),
        }),
      );
    const visitor = localStorage.getItem("labor-ads-visitor") || crypto.randomUUID();
    localStorage.setItem("labor-ads-visitor", visitor);
    const config = await adsTrackingConfig();
    if (config.pixel && /^\d+$/.test(config.pixel)) {
      if (!window.fbq) {
        const queue: unknown[][] = [];
        const fbq = function (...args: unknown[]) {
          const f = fbq as unknown as { callMethod?: (...a: unknown[]) => void };
          if (f.callMethod) f.callMethod(...args);
          else queue.push(args);
        };
        Object.assign(fbq, { queue, push: fbq, loaded: true, version: "2.0" });
        window.fbq = fbq;
        window._fbq = fbq;
        const script = document.createElement("script");
        script.async = true;
        script.src = "https://connect.facebook.net/en_US/fbevents.js";
        document.head.appendChild(script);
        window.fbq("init", config.pixel);
      }
      window.fbq(
        "track",
        name,
        productId ? { content_ids: [productId], content_type: "product" } : {},
        { eventID: id },
      );
    }
    await adsTrack({
      data: {
        id,
        name,
        at,
        productId,
        campaign: campaignOrigin()?.campaign,
        visitor,
        consent: true,
      },
    });
  } catch {
    /* Analytics never blocks shopping or checkout. */
  }
}
