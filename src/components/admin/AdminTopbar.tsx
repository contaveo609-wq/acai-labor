import { useState } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Bell, ExternalLink, PackageCheck, MessageSquare } from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { fetchUnreadNotificationCount } from "@/lib/admin-data";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export function AdminTopbar() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [popoverOpen, setPopoverOpen] = useState(false);

  const { data: store } = useQuery({
    queryKey: ["admin_store_status"],
    queryFn: async () => {
      const { data } = await supabase.from("store_settings").select("is_open").maybeSingle();
      return data;
    },
  });

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["unread_notification_count"],
    queryFn: fetchUnreadNotificationCount,
  });

  const { data: notifications = [] } = useQuery({
    queryKey: ["admin_notifications"],
    queryFn: async () => {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      return data || [];
    },
  });

  async function handleOpenChange(open: boolean) {
    setPopoverOpen(open);
    if (open && unreadCount > 0) {
      // Mark all as read
      await supabase.from("notifications").update({ is_read: true }).eq("is_read", false);
      queryClient.invalidateQueries({ queryKey: ["unread_notification_count"] });
      queryClient.invalidateQueries({ queryKey: ["admin_notifications"] });
    }
  }

  function handleNotificationClick(link: string | null) {
    setPopoverOpen(false);
    if (link) {
      // Very simple parsing: link might be "/admin/pedidos?id=xxx"
      const url = new URL(link, window.location.origin);
      if (url.pathname === "/admin/pedidos") {
        const id = url.searchParams.get("id");
        navigate({ to: "/admin/pedidos", search: { id } as any }); // Need to ensure router handles this or trigger an event
        if (id) {
            window.dispatchEvent(new CustomEvent("open-order-modal", { detail: id }));
        }
      } else {
        navigate({ to: url.pathname as any });
      }
    }
  }

  return (
    <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-4 border-b border-border bg-background px-4 shadow-sm md:px-6">
      <SidebarTrigger className="-ml-2" />

      <div className="flex flex-1 items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span
              className={`relative flex h-3 w-3 ${
                store?.is_open ? "text-success" : "text-destructive"
              }`}
            >
              <span
                className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${
                  store?.is_open ? "bg-success" : "bg-destructive"
                }`}
              ></span>
              <span
                className={`relative inline-flex h-3 w-3 rounded-full ${
                  store?.is_open ? "bg-success" : "bg-destructive"
                }`}
              ></span>
            </span>
            <span className="text-sm font-medium hidden sm:inline-block">
              {store?.is_open ? "Loja Aberta" : "Loja Fechada"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          <Popover open={popoverOpen} onOpenChange={handleOpenChange}>
            <PopoverTrigger asChild>
              <button className="relative flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted text-muted-foreground transition-colors">
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute right-1 top-1 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground border border-background">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-0 sm:w-96">
              <div className="flex items-center justify-between border-b border-border p-4">
                <h3 className="font-semibold">Notificações</h3>
                {unreadCount > 0 && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    {unreadCount} {unreadCount === 1 ? 'nova' : 'novas'}
                  </span>
                )}
              </div>
              <div className="max-h-[400px] overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    Nenhuma notificação no momento.
                  </div>
                ) : (
                  <div className="flex flex-col">
                    {notifications.map((notif: any) => (
                      <button
                        key={notif.id}
                        onClick={() => handleNotificationClick(notif.link)}
                        className={`flex items-start gap-3 border-b border-border/50 p-4 text-left transition-colors hover:bg-muted/50 ${
                          !notif.is_read ? 'bg-primary/5' : ''
                        }`}
                      >
                        <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                          notif.type === 'novo_pedido' ? 'bg-primary/20 text-primary' : 
                          notif.type === 'ia_pendencia' ? 'bg-amber-500/20 text-amber-600' :
                          'bg-muted text-muted-foreground'
                        }`}>
                          {notif.type === 'novo_pedido' ? <PackageCheck className="h-4 w-4" /> : 
                           notif.type === 'ia_pendencia' ? <MessageSquare className="h-4 w-4" /> :
                           <Bell className="h-4 w-4" />}
                        </div>
                        <div className="flex-1 space-y-1">
                          <p className={`text-sm ${!notif.is_read ? 'font-semibold' : 'font-medium'}`}>
                            {notif.title}
                          </p>
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {notif.message}
                          </p>
                          <p className="text-[10px] text-muted-foreground/70">
                            {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true, locale: ptBR })}
                          </p>
                        </div>
                        {!notif.is_read && (
                          <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>

          <Link
            to="/"
            target="_blank"
            className="hidden items-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground md:flex"
          >
            <ExternalLink className="h-4 w-4" />
            Ver loja
          </Link>
        </div>
      </div>
    </header>
  );
}
