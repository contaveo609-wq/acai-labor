import { useQuery } from "@tanstack/react-query";
import { fetchStoreSettings, whatsappLink } from "@/lib/menu";

export function WhatsAppButton() {
  const { data: store } = useQuery({ queryKey: ["store"], queryFn: fetchStoreSettings });
  const wa = store?.whatsapp ?? "556681055779";

  return (
    <a
      href={whatsappLink(wa, "Olá! Vim pelo site da Skina do Frango & Assados.")}
      target="_blank"
      rel="noreferrer"
      aria-label="Falar no WhatsApp"
      className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-success text-success-foreground shadow-xl transition-transform hover:scale-105"
    >
      <svg viewBox="0 0 24 24" className="h-7 w-7 fill-current" aria-hidden="true">
        <path d="M12.04 2c-5.5 0-9.96 4.46-9.96 9.96 0 1.76.46 3.48 1.34 5L2 22l5.2-1.36a9.9 9.9 0 0 0 4.84 1.24h.01c5.5 0 9.96-4.46 9.96-9.96S17.54 2 12.04 2Zm5.8 14.06c-.24.68-1.4 1.3-1.94 1.34-.5.04-.98.22-3.3-.7-2.78-1.1-4.54-3.94-4.68-4.12-.14-.18-1.12-1.48-1.12-2.82s.7-2 .95-2.28c.24-.28.52-.34.7-.34h.5c.16 0 .38-.06.6.46.24.56.8 1.94.88 2.08.08.14.12.3.02.48-.1.18-.16.3-.3.46-.14.16-.3.36-.44.48-.14.14-.3.3-.13.58.17.28.75 1.24 1.6 2 1.1.98 2.02 1.28 2.3 1.42.28.14.44.12.6-.08.16-.2.7-.82.88-1.1.18-.28.36-.24.6-.14.24.1 1.54.72 1.8.86.26.14.44.2.5.32.06.12.06.68-.18 1.36Z" />
      </svg>
    </a>
  );
}
