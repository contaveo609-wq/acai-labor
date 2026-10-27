import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchStoreSettings } from "@/lib/menu";
import { DEFAULT_BRAND } from "@/lib/vendrex.rules";
export function VendrexTheme() {
  const { data } = useQuery({ queryKey: ["store"], queryFn: fetchStoreSettings });
  useEffect(() => {
    const primary = data?.primary_color || DEFAULT_BRAND.primary_color;
    const accent = data?.accent_color || DEFAULT_BRAND.accent_color;
    for (const [key, value] of Object.entries({
      "--primary": primary,
      "--brand": primary,
      "--brand-dark": `color-mix(in srgb, ${primary} 65%, #18030e)`,
      "--ring": primary,
      "--gold": accent,
      "--secondary": `color-mix(in srgb, ${primary} 8%, white)`,
      "--accent": `color-mix(in srgb, ${accent} 22%, white)`,
      "--accent-foreground": `color-mix(in srgb, ${primary} 75%, #18030e)`,
      "--border": `color-mix(in srgb, ${primary} 15%, white)`,
    }))
      document.body.style.setProperty(key, value);
  }, [data?.primary_color, data?.accent_color]);
  return null;
}
