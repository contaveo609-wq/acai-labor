import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import type { AdminRole } from "./permissions";
import { ROLE_PERMISSIONS } from "./permissions";
import { supabase } from "@/integrations/supabase/client";
export type AdminUser = {
  id: string;
  username: string;
  displayName: string;
  role: AdminRole;
  permissions: string[];
};
type AdminAuthContextValue = {
  user: AdminUser | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
};
const AdminAuthContext = createContext<AdminAuthContextValue>({
  user: null,
  isAuthenticated: false,
  login: async () => false,
  logout: () => {},
});
export const useAdminAuth = () => useContext(AdminAuthContext);
// Supabase Auth verifies passwords. RLS authorizes data operations.
export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const resolve = useCallback(async (id: string, email: string) => {
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", id)
      .eq("role", "admin")
      .maybeSingle();
    if (error || !data) {
      setUser(null);
      return false;
    }
    setUser({
      id,
      username: email,
      displayName: email,
      role: "ADMIN_MASTER",
      permissions: ROLE_PERMISSIONS.ADMIN_MASTER,
    });
    return true;
  }, []);
  useEffect(() => {
    localStorage.removeItem("skina_admin_session");
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active && data.session) void resolve(data.session.user.id, data.session.user.email || "");
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) setUser(null);
      else
        setTimeout(() => {
          if (active) void resolve(session.user.id, session.user.email || "");
        }, 0);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [resolve]);
  const login = useCallback(
    async (email: string, password: string) => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error || !data.user) return false;
      const allowed = await resolve(data.user.id, data.user.email || email);
      if (!allowed) await supabase.auth.signOut();
      return allowed;
    },
    [resolve],
  );
  const logout = useCallback(() => {
    setUser(null);
    void supabase.auth.signOut();
  }, []);
  return (
    <AdminAuthContext.Provider value={{ user, isAuthenticated: !!user, login, logout }}>
      {children}
    </AdminAuthContext.Provider>
  );
}
