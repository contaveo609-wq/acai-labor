import { Link, useLocation } from "@tanstack/react-router";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useAdminAuth } from "@/lib/admin-auth";
import {
  LayoutDashboard,
  ClipboardList,
  UtensilsCrossed,
  Tags,
  Percent,
  Ticket,
  Clock,
  LogOut,
  Users,
  MessageSquare,
  Gift,
  Star,
  BarChart3,
  ShieldCheck,
  Settings,
  Store,
  Bike,
  Phone,
  MessageSquareWarning,
  FlaskConical,
} from "lucide-react";

export function AdminSidebar({ onLogout }: { onLogout: () => void }) {
  const { user } = useAdminAuth();
  const location = useLocation();

  // Highlight exact match or prefix
  const isActive = (path: string) =>
    location.pathname === path || (path !== "/admin" && location.pathname.startsWith(path));

  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border h-16 flex items-center justify-center px-4">
        <div className="flex items-center gap-2 font-display text-lg text-sidebar-foreground">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Store className="h-5 w-5" />
          </div>
          <span className="truncate group-data-[collapsible=icon]:hidden">Painel Skina</span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* OPERAÇÃO */}
        <SidebarGroup>
          <SidebarGroupLabel>Operação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/admin")} tooltip="Dashboard">
                  <Link to="/admin">
                    <LayoutDashboard />
                    <span>Dashboard</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/admin/pedidos")} tooltip="Pedidos">
                  <Link to="/admin/pedidos">
                    <ClipboardList />
                    <span>Pedidos</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/admin/expedicao")} tooltip="Expedição">
                  <Link to="/admin/expedicao">
                    <Bike />
                    <span>Expedição</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/admin/entregadores")} tooltip="Entregadores">
                  <Link to="/admin/entregadores">
                    <Bike />
                    <span>Entregadores</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* LOJA & CARDÁPIO */}
        <SidebarGroup>
          <SidebarGroupLabel>Loja & Cardápio</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/admin/produtos")} tooltip="Produtos">
                  <Link to="/admin/produtos">
                    <UtensilsCrossed />
                    <span>Produtos</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/admin/categorias")} tooltip="Categorias">
                  <Link to="/admin/categorias">
                    <Tags />
                    <span>Categorias</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/admin/promocoes")} tooltip="Promoções">
                  <Link to="/admin/promocoes">
                    <Percent />
                    <span>Promoções</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/admin/cupons")} tooltip="Cupons">
                  <Link to="/admin/cupons">
                    <Ticket />
                    <span>Cupons</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/admin/horarios")} tooltip="Horários">
                  <Link to="/admin/horarios">
                    <Clock />
                    <span>Horários</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* CLIENTES & MARKETING */}
        <SidebarGroup>
          <SidebarGroupLabel>Clientes & CRM</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/admin/clientes")} tooltip="Clientes">
                  <Link to="/admin/clientes">
                    <Users />
                    <span>Clientes</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/admin/fidelidade")} tooltip="Fidelidade">
                  <Link to="/admin/fidelidade">
                    <Gift />
                    <span>Fidelidade</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/admin/campanhas")} tooltip="Campanhas">
                  <Link to="/admin/campanhas">
                    <MessageSquare />
                    <span>Campanhas</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/admin/chatbot")} tooltip="Atendente Virtual">
                  <Link to="/admin/chatbot">
                    <MessageSquare className="text-blue-500" />
                    <span>Atendente (IA)</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/admin/whatsapp")} tooltip="Integração WhatsApp">
                  <Link to="/admin/whatsapp">
                    <Phone className="text-green-500" />
                    <span>WhatsApp</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/admin/pendencias-ia")} tooltip="Pendências da IA">
                  <Link to="/admin/pendencias-ia">
                    <MessageSquareWarning className="text-orange-500" />
                    <span>Pendências da IA</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/admin/testes-integracoes")} tooltip="Testes de Integração">
                  <Link to="/admin/testes-integracoes">
                    <FlaskConical className="text-purple-500" />
                    <span>Testes de Integração</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/admin/satisfacao")} tooltip="Satisfação">
                  <Link to="/admin/satisfacao">
                    <Star />
                    <span>Satisfação</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* SISTEMA */}
        <SidebarGroup>
          <SidebarGroupLabel>Sistema</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/admin/relatorios")} tooltip="Relatórios">
                  <Link to="/admin/relatorios">
                    <BarChart3 />
                    <span>Relatórios</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/admin/usuarios")} tooltip="Usuários">
                  <Link to="/admin/usuarios">
                    <ShieldCheck />
                    <span>Usuários (RBAC)</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/admin/configuracoes")} tooltip="Configurações">
                  <Link to="/admin/configuracoes">
                    <Settings />
                    <span>Configurações</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        <div className="mb-2 flex items-center gap-3 overflow-hidden group-data-[collapsible=icon]:hidden">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
            <span className="font-semibold text-muted-foreground">
              {user?.displayName?.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex flex-col overflow-hidden">
            <span className="truncate text-sm font-semibold">{user?.displayName}</span>
            <span className="truncate text-xs text-muted-foreground">{user?.role}</span>
          </div>
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={onLogout} tooltip="Sair" className="text-destructive hover:bg-destructive/10 hover:text-destructive">
              <LogOut />
              <span>Sair do painel</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
