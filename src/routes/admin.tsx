import { createFileRoute, Outlet, redirect, useRouter } from "@tanstack/react-router";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminTopbar } from "@/components/admin/AdminTopbar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { useAdminAuth, AdminAuthProvider } from "@/lib/admin-auth";
import { useRealtimeOrders } from "@/hooks/useRealtimeOrders";
import { DEMO_MODE } from "@/lib/demo";
import { LaborAdmin } from "@/components/admin/LaborAdmin";

export const Route = createFileRoute("/admin")({
  ssr: false,
  beforeLoad: ({ location }) => {
    // We check auth within the component as well, but this helps redirect early
    // However, since useAdminAuth uses localStorage, we can't reliably read it
    // in beforeLoad if it's running on server or before context is ready.
    // So we'll handle the redirect inside the component.
  },
  head: () =>
    DEMO_MODE
      ? {
          meta: [
            { title: "Painel — Açaí Labor" },
            {
              name: "description",
              content: "Administração da Açaí Labor.",
            },
            { name: "robots", content: "noindex, nofollow" },
          ],
        }
      : {
          meta: [
            {
              title: DEMO_MODE
                ? "Painel administrativo — Açaí Labor"
                : "Painel administrativo — Skina do Frango & Assados",
            },
            { name: "robots", content: "noindex, nofollow" },
          ],
        },
  component: () =>
    DEMO_MODE ? (
      <LaborAdmin />
    ) : (
      <AdminAuthProvider>
        <AdminLayout />
      </AdminAuthProvider>
    ),
});

function AdminLayout() {
  const { isAuthenticated, logout } = useAdminAuth();
  const router = useRouter();

  // Listen to realtime incoming orders with sound and desktop notifications
  useRealtimeOrders();

  // Protect all /admin routes except /admin/login
  const isLoginPage = router.state.location.pathname === "/admin/login";

  if (!isAuthenticated && !isLoginPage) {
    // Redirect to local admin login
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="text-center">
          <p className="mb-4 text-muted-foreground">Você precisa estar logado para acessar.</p>
          <a
            href="/admin/login"
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Fazer login
          </a>
        </div>
      </div>
    );
  }

  if (isLoginPage) {
    return <Outlet />;
  }

  return (
    <SidebarProvider>
      <AdminSidebar onLogout={logout} />
      <SidebarInset>
        <AdminTopbar />
        <main className="flex-1 overflow-auto bg-muted/20 p-4 md:p-6">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
