import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { trackAdEvent } from "@/lib/ads.tracking";
export function MarketingConsent() {
  const [choice, setChoice] = useState<string | null>(null),
    [ready, setReady] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });
  useEffect(() => {
    setChoice(localStorage.getItem("labor-marketing-consent"));
    setReady(true);
  }, []);
  useEffect(() => {
    if (choice === "yes") void trackAdEvent(path === "/checkout" ? "InitiateCheckout" : "PageView");
  }, [choice, path]);
  function choose(value: string) {
    localStorage.setItem("labor-marketing-consent", value);
    setChoice(value);
    if (value !== "yes") {
      sessionStorage.removeItem("labor-campaign-origin");
      localStorage.removeItem("labor-ads-visitor");
      window.fbq?.("consent", "revoke");
    } else window.fbq?.("consent", "grant");
  }
  if (!ready) return null;
  return (
    <aside
      className="mx-auto my-3 max-w-3xl rounded-xl border p-3 text-sm"
      aria-label="Preferências de publicidade"
    >
      {choice ? (
        <button
          type="button"
          onClick={() => {
            choose("no");
            setChoice(null);
          }}
        >
          Preferências de publicidade
        </button>
      ) : (
        <>
          <p>
            Permitir medição de anúncios pela Meta? Você pode comprar sem aceitar e mudar sua
            escolha aqui.
          </p>
          <button type="button" className="m-2 underline" onClick={() => choose("yes")}>
            Permitir medição
          </button>
          <button type="button" className="m-2 underline" onClick={() => choose("no")}>
            Recusar
          </button>
        </>
      )}
    </aside>
  );
}
