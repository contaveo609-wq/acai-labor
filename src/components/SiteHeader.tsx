import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  MapPin,
  Search,
  ShoppingBag,
  Timer,
  User2,
  LogOut,
  ClipboardList,
  Shield,
} from "lucide-react";
import { useCart } from "@/lib/cart";
import { fetchStoreSettings } from "@/lib/menu";
import { useIsAdmin, useSession } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DEMO_MODE } from "@/lib/demo";
import { LaborHeader } from "./LaborHeader";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function SiteHeader({
  search,
  onSearchChange,
  onOpenCart,
}: {
  search?: string | undefined;
  onSearchChange?: ((value: string) => void) | undefined;
  onOpenCart?: (() => void) | undefined;
}) {
  if (DEMO_MODE) return <LaborHeader search={search} onSearchChange={onSearchChange} />;
  return <OriginalHeader search={search} onSearchChange={onSearchChange} onOpenCart={onOpenCart} />;
}

function OriginalHeader({
  search,
  onSearchChange,
  onOpenCart,
}: {
  search?: string | undefined;
  onSearchChange?: ((v: string) => void) | undefined;
  onOpenCart?: (() => void) | undefined;
}) {
  const { data: store } = useQuery({ queryKey: ["store"], queryFn: fetchStoreSettings });
  const { count } = useCart();
  const { user } = useSession();
  const isAdmin = useIsAdmin(user?.id);
  const navigate = useNavigate();

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  return (
    <header className="sticky top-0 z-40 brand-gradient text-primary-foreground shadow-lg">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-3 py-3 sm:px-5">
        <Link to="/" className="flex shrink-0 items-center gap-2">
          {store?.logo_url ? (
            <img
              src={store.logo_url}
              alt="Skina do Frango & Assados"
              width={48}
              height={48}
              className="h-11 w-11 rounded-xl object-cover ring-2 ring-gold/70 sm:h-12 sm:w-12"
            />
          ) : (
            <div className="h-11 w-11 rounded-xl bg-gold/30" />
          )}
          <span className="hidden font-display text-2xl leading-none tracking-wide sm:block">
            Skina do Frango
            <span className="block text-sm text-gold">& Assados</span>
          </span>
        </Link>

        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search ?? ""}
            onChange={(e) => {
              if (onSearchChange) onSearchChange(e.target.value);
              else navigate({ to: "/cardapio" });
            }}
            onFocus={() => {
              if (!onSearchChange) navigate({ to: "/cardapio" });
            }}
            placeholder="Buscar no cardápio..."
            aria-label="Buscar no cardápio"
            className="h-10 rounded-full border-0 bg-card pl-9 text-foreground shadow-sm"
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Conta"
              className="shrink-0 rounded-full text-primary-foreground hover:bg-white/15 hover:text-primary-foreground"
            >
              <User2 className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            {user ? (
              <>
                <DropdownMenuItem asChild>
                  <Link to="/minha-conta">
                    <User2 className="mr-2 h-4 w-4" /> Minha conta
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/meus-pedidos">
                    <ClipboardList className="mr-2 h-4 w-4" /> Meus pedidos
                  </Link>
                </DropdownMenuItem>
                {isAdmin ? (
                  <DropdownMenuItem asChild>
                    <Link to="/admin">
                      <Shield className="mr-2 h-4 w-4" /> Painel administrativo
                    </Link>
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut}>
                  <LogOut className="mr-2 h-4 w-4" /> Sair
                </DropdownMenuItem>
              </>
            ) : (
              <>
                <DropdownMenuItem asChild>
                  <Link to="/login">Entrar</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/cadastro">Criar conta</Link>
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <button
          type="button"
          onClick={() => (onOpenCart ? onOpenCart() : navigate({ to: "/carrinho" }))}
          aria-label="Abrir carrinho"
          className="relative shrink-0 rounded-full bg-gold p-2.5 text-gold-foreground transition-transform hover:scale-105"
        >
          <ShoppingBag className="h-5 w-5" />
          {count > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-card px-1 text-xs font-bold text-primary">
              {count}
            </span>
          ) : null}
        </button>
      </div>

      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-1 px-3 pb-2 text-xs sm:px-5">
        <span className="inline-flex items-center gap-1">
          <MapPin className="h-3.5 w-3.5 text-gold" />
          {store?.address_line ?? "Jardim Primavera — Rondonópolis/MT"}
        </span>
        <span className="inline-flex items-center gap-1">
          <Timer className="h-3.5 w-3.5 text-gold" />
          Entrega estimada: {store?.delivery_time_min ?? 40}–{store?.delivery_time_max ?? 57} min
        </span>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${
            store?.is_open === false ? "bg-black/30" : "bg-success text-success-foreground"
          }`}
        >
          {store?.is_open === false ? "Fechado agora" : "Aberto agora"}
        </span>
      </div>
    </header>
  );
}
