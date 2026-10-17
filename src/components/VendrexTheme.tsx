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
      "--ring": primary,
      "--gold": accent,
    }))
      document.body.style.setProperty(key, value);
  }, [data?.primary_color, data?.accent_color]);
  return null;
}
