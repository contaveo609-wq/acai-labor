import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchStoreSettings, whatsappLink } from "@/lib/menu";
import { DEMO_MODE } from "@/lib/demo";

export function SiteFooter() {
  const { data: store } = useQuery({ queryKey: ["store"], queryFn: fetchStoreSettings });
  const wa = store?.whatsapp ?? "556681055779";
  if (DEMO_MODE)
    return (
      <footer className="labor-footer" id="informacoes">
        <div>
          <Link to="/" className="footer-brand">
            {store?.store_name || "Açaí Labor"}
            <span>↗</span>
          </Link>
          <p>{store?.tagline || "Mais sabor no seu dia."}</p>
          <p className="max-w-xs">{store?.description}</p>
          <small>
            {store?.address_line} · {store?.opening_hours}
          </small>
        </div>
        <nav aria-label="Rodapé">
          <Link to="/cardapio">Explorar cardápio</Link>
          <Link to="/carrinho">Meu pedido</Link>
          <Link to="/admin">Área da loja ↗</Link>
        </nav>
        <p className="footer-note">
          Açaí, cupuaçu, sorvetes e muito mais.
          <br />
          <small>Demonstração local • catálogo público importado</small>
        </p>
      </footer>
    );

  return (
    <footer className="mt-16 brand-gradient text-primary-foreground">
      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-10 sm:grid-cols-3">
        <div>
          <h2 className="font-display text-3xl">Skina do Frango & Assados</h2>
          <p className="mt-2 text-sm opacity-90">
            {store?.address_line ?? "Jardim Primavera — Rondonópolis/MT"}
          </p>
          <p className="text-sm opacity-90">
            Entrega estimada: {store?.delivery_time_min ?? 40}–{store?.delivery_time_max ?? 57} min
          </p>
          <p className="text-sm opacity-90">{store?.opening_hours}</p>
          <a
            href={whatsappLink(wa, "Olá! Vim pelo site e gostaria de fazer um pedido.")}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-block font-semibold text-gold"
          >
            WhatsApp: +55 66 8105-5779
          </a>
        </div>

        <nav className="text-sm">
          <h3 className="font-display text-xl text-gold">Navegue</h3>
          <ul className="mt-2 space-y-1.5">
            <li>
              <Link to="/cardapio">Cardápio</Link>
            </li>
            <li>
              <Link to="/meus-pedidos">Meus pedidos</Link>
            </li>
            <li>
              <Link to="/login">Login</Link>
            </li>
            <li>
              <a href={whatsappLink(wa)} target="_blank" rel="noreferrer">
                Fale conosco
              </a>
            </li>
          </ul>
        </nav>

        <nav className="text-sm">
          <h3 className="font-display text-xl text-gold">Institucional</h3>
          <ul className="mt-2 space-y-1.5">
            <li>
              <Link to="/privacidade">Política de privacidade</Link>
            </li>
            <li>
              <Link to="/termos">Termos de uso</Link>
            </li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-white/15 py-4 text-center text-xs opacity-80">
        © {new Date().getFullYear()} Skina do Frango & Assados — Rondonópolis/MT
      </div>
    </footer>
  );
}
