import { Link } from "@tanstack/react-router";
import { Search, ShoppingBag, ArrowUpRight, MapPin } from "lucide-react";
import { operatingAt } from "@/lib/vendrex.rules";
import { useQuery } from "@tanstack/react-query";
import { useCart } from "@/lib/cart";
import { fetchStoreSettings, formatBRL, whatsappLink } from "@/lib/menu";
export function LaborHeader({
  search,
  onSearchChange,
}: {
  search?: string | undefined;
  onSearchChange?: ((v: string) => void) | undefined;
}) {
  const { count, subtotal } = useCart();
  const { data: store } = useQuery({ queryKey: ["store"], queryFn: fetchStoreSettings });
  return (
    <>
      <header className="labor-header">
        <div className="labor-header-inner">
          <Link
            to="/"
            className="labor-logo"
            aria-label={`${store?.store_name || "Açaí Labor"}, início`}
          >
            {store?.logo_url ? (
              <img
                src={store.logo_url}
                alt=""
                width={44}
                height={44}
                className="h-11 w-11 object-contain"
              />
            ) : (
              <span className="logo-symbol">a<span>✦</span></span>
            )}
            <span>
              {store?.store_name || "Açaí Labor"}
              <small>{store?.tagline || "MAIS SABOR NO SEU DIA"}</small>
            </span>
          </Link>
          <nav className="desktop-nav" aria-label="Principal">
            <Link to="/cardapio">Cardápio</Link>
            <a href={store?.whatsapp ? whatsappLink(store.whatsapp) : "#informacoes"}>
              {store?.whatsapp ? "Fale com a gente" : "Informações"}
              <ArrowUpRight size={13} />
            </a>
          </nav>
          <Link
            to="/carrinho"
            className="header-cart"
            aria-label={`Abrir carrinho, ${count} itens`}
          >
            <ShoppingBag size={19} />
            <span>
              Meu pedido
              <small>
                {count
                  ? `${count} ${count === 1 ? "item" : "itens"} · ${formatBRL(subtotal)}`
                  : "Que tal um açaí?"}
              </small>
            </span>
            {count > 0 && <b>{count}</b>}
          </Link>
        </div>
        {onSearchChange && (
          <div className="header-search-row">
            <div className="header-place">
              <MapPin size={15} />
              <span>{store?.address_line || "Vila Nova Galvão, São Paulo"}</span>
              <i className={store?.is_open && operatingAt(store) ? "open-dot" : "closed-dot"} />
              <strong>
                {store?.is_open && operatingAt(store) ? "Recebendo pedidos" : "Fora do atendimento"}
              </strong>
            </div>
            <div className="labor-search">
              <Search size={17} />
              <input
                aria-label="Buscar no catálogo"
                placeholder="O que vai deixar seu dia mais gostoso?"
                value={search || ""}
                onChange={(e) => onSearchChange(e.target.value)}
              />
              {search && (
                <button type="button" onClick={() => onSearchChange("")} aria-label="Limpar busca">
                  ×
                </button>
              )}
            </div>
          </div>
        )}
      </header>
    </>
  );
}
